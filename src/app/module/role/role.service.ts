import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog, diffFields } from "../../utils/auditLog";
import { systemRoleTemplates } from "../../utils/seed";
import type {
	IPermissionAssignPayload,
	IRoleCreatePayload,
	IRoleUpdatePayload,
} from "./role.interface";

// Resolves the permissions to attach to a role: de-dupes, pulls in each action's
// "<module>.view" dependency, and rejects IDs the caller doesn't hold (no
// privilege escalation) or that don't exist. Shared by create + assign.
const resolveAssignablePermissions = async (
	inputPermissionIds: string[],
	user: IRequestUser,
): Promise<{ id: string; name: string }[]> => {
	const inputIds = [...new Set(inputPermissionIds)];

	const allPermissions = await prisma.permission.findMany({
		select: { id: true, name: true },
	});
	const idByName = new Map(allPermissions.map((p) => [p.name, p.id]));
	const nameById = new Map(allPermissions.map((p) => [p.id, p.name]));
	const SELF_ACTIONS = new Set(["view", "view_own"]);

	const withDeps = new Set(inputIds);
	for (const id of inputIds) {
		const [moduleName, action] = (nameById.get(id) ?? "").split(".");
		// Only "act on all" permissions pull in the module's view; self-service
		// ones (view/view_own and any *_own action) stand alone.
		if (action && !SELF_ACTIONS.has(action) && !action.endsWith("_own")) {
			const viewId = idByName.get(`${moduleName}.view`);
			if (viewId) withDeps.add(viewId);
		}
	}

	const userWithRole = await prisma.user.findUnique({
		where: { id: user.userId },
		include: {
			role: { include: { permissions: { select: { permissionId: true } } } },
		},
	});
	const userPermissionIds = new Set(
		userWithRole?.role.permissions.map((rp) => rp.permissionId) || [],
	);

	const unauthorizedPerms = [...withDeps].filter(
		(permId) => !userPermissionIds.has(permId),
	);
	if (unauthorizedPerms.length > 0) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`You cannot assign permissions you don't have: ${unauthorizedPerms.join(", ")}`,
		);
	}

	const resolved = allPermissions.filter((p) => withDeps.has(p.id));
	if (resolved.length !== withDeps.size) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"One or more permission IDs are invalid",
		);
	}

	return resolved;
};

const createRole = async (payload: IRoleCreatePayload, user: IRequestUser) => {
	const { name, description, permissionIds } = payload;

	const existingRole = await prisma.role.findFirst({
		where: {
			name: name,
			organizationId: user.organizationId,
			deletedAt: null,
		},
	});

	if (existingRole) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Role name already exists in this organization",
		);
	}

	// A role with no permissions can't do anything, so creation assigns its
	// starting set up front (validated/resolved before we touch the role).
	const resolvedPermissions = await resolveAssignablePermissions(permissionIds, user);

	// A soft-deleted role still holds the (organizationId, name) unique slot, so
	// recreating that name would hit the DB unique constraint. Revive the deleted
	// row (dropping its old permissions) instead of inserting.
	const softDeletedRole = await prisma.role.findFirst({
		where: { name, organizationId: user.organizationId, deletedAt: { not: null } },
	});

	const role = await prisma.$transaction(async (tx) => {
		const created = softDeletedRole
			? await tx.role.update({
					where: { id: softDeletedRole.id },
					data: { description: description ?? null, deletedAt: null, createdAt: new Date() },
				})
			: await tx.role.create({
					data: {
						name: name,
						description: description,
						organizationId: user.organizationId,
					},
				});

		if (softDeletedRole) {
			await tx.rolePermission.deleteMany({ where: { roleId: created.id } });
		}
		await tx.rolePermission.createMany({
			data: resolvedPermissions.map((p) => ({ roleId: created.id, permissionId: p.id })),
			skipDuplicates: true,
		});
		return created;
	});

	createAuditLog({
		user,
		action: AuditAction.CREATE_ROLE,
		entity: "Role",
		entityId: role.id,
		metadata: {
			roleName: name,
			description: description ?? null,
			permissionCount: resolvedPermissions.length,
		},
	});

	return role;
};

const getAllRoles = async (user: IRequestUser) => {
	const roles = await prisma.role.findMany({
		where: {
			organizationId: user.organizationId,
			deletedAt: null,
		},
		include: {
			_count: {
				select: {
					users: true,
					permissions: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return roles;
};

const getRoleById = async (id: string, user: IRequestUser) => {
	const role = await prisma.role.findUnique({
		where: { id },
		include: {
			permissions: {
				include: {
					permission: true,
				},
			},
			_count: {
				select: {
					users: true,
				},
			},
		},
	});

	if (!role || role.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view roles in your organization",
		);
	}

	return role;
};

const updateRole = async (
	id: string,
	payload: IRoleUpdatePayload,
	user: IRequestUser,
) => {
	const { name, description } = payload;

	const role = await prisma.role.findUnique({
		where: { id },
	});

	if (!role) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}

	if (role.deletedAt) {
		throw new AppError(httpStatus.BAD_REQUEST, "Cannot modify deleted role");
	}

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update roles in your organization",
		);
	}

	if (role.isSystem) {
		throw new AppError(httpStatus.FORBIDDEN, "Cannot modify system roles");
	}

	// Check if new name conflicts with existing role
	if (name && name !== role.name) {
		const existingRole = await prisma.role.findFirst({
			where: {
				name,
				organizationId: user.organizationId,
				deletedAt: null,
			},
		});

		if (existingRole) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Role name already exists in this organization",
			);
		}

		// Prevent renaming if role is assigned to users
		const userCount = await prisma.user.count({
			where: { roleId: id },
		});

		if (userCount > 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot rename role that is assigned to users. Reassign users first.",
			);
		}
	}

	const updatedRole = await prisma.role.update({
		where: { id },
		data: { name, description },
	});

	createAuditLog({
		user,
		action: AuditAction.UPDATE_ROLE,
		entity: "Role",
		entityId: id,
		metadata: {
			roleName: updatedRole.name,
			changes: diffFields(role, updatedRole, ["name", "description"]),
		},
	});

	return updatedRole;
};

const deleteRole = async (id: string, user: IRequestUser) => {
	const role = await prisma.role.findUnique({
		where: { id },
		include: {
			_count: {
				select: { users: true },
			},
		},
	});

	if (!role) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only delete roles in your organization",
		);
	}

	if (role.isSystem) {
		throw new AppError(httpStatus.FORBIDDEN, "Cannot delete system roles");
	}

	if (role._count.users > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete role with assigned users. Reassign users first.",
		);
	}

	await prisma.role.update({
		where: { id },
		data: { deletedAt: new Date() },
	});

	createAuditLog({
		user,
		action: AuditAction.DELETE_ROLE,
		entity: "Role",
		entityId: id,
		metadata: { roleName: role.name },
	});

	return { message: "Role deleted successfully" };
};

// Permission APIs
const getAllPermissions = async () => {
	const permissions = await prisma.permission.findMany({
		orderBy: { name: "asc" },
	});

	return permissions;
};

const getRolePermissions = async (roleId: string, user: IRequestUser) => {
	const role = await prisma.role.findUnique({
		where: { id: roleId },
	});

	if (!role || role.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view permissions for roles in your organization",
		);
	}

	const permissions = await prisma.rolePermission.findMany({
		where: { roleId },
		include: {
			permission: true,
		},
	});

	return permissions.map((rp) => rp.permission);
};

const assignPermissions = async (
	roleId: string,
	payload: IPermissionAssignPayload,
	user: IRequestUser,
) => {
	const role = await prisma.role.findUnique({
		where: { id: roleId },
	});

	if (!role) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}

	if (role.deletedAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot assign permissions to a deleted role",
		);
	}

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update permissions for roles in your organization",
		);
	}

	// Prevent modifying own role
	const currentUser = await prisma.user.findUnique({
		where: { id: user.userId },
	});

	if (currentUser?.roleId === roleId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot modify permissions of your own role",
		);
	}

	const permissions = await resolveAssignablePermissions(payload.permissionIds, user);
	const permissionIds = permissions.map((p) => p.id);

	await prisma.$transaction(async (tx) => {
		const previous = await tx.rolePermission.findMany({
			where: { roleId },
			select: { permission: { select: { name: true } } },
		});
		const before = new Set(previous.map((rp) => rp.permission.name));
		const after = new Set(permissions.map((p) => p.name));

		await tx.rolePermission.deleteMany({
			where: { roleId },
		});

		await tx.rolePermission.createMany({
			data: permissionIds.map((permissionId) => ({
				roleId,
				permissionId,
			})),
			skipDuplicates: true,
		});

		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.ASSIGN_PERMISSIONS,
				entity: "Role",
				entityId: roleId,
				metadata: {
					roleName: role.name,
					added: [...after].filter((name) => !before.has(name)).sort(),
					removed: [...before].filter((name) => !after.has(name)).sort(),
					total: after.size,
				},
			},
		});
	});

	return prisma.role.findUnique({
		where: { id: roleId },
		include: {
			permissions: {
				include: {
					permission: true,
				},
			},
		},
	});
};

const removePermission = async (
	roleId: string,
	permissionId: string,
	user: IRequestUser,
) => {
	const role = await prisma.role.findUnique({
		where: { id: roleId },
	});

	if (!role) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}

	if (role.deletedAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot remove permissions from a deleted role",
		);
	}

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update permissions for roles in your organization",
		);
	}

	// Get user's current role to prevent removing own permissions
	const currentUser = await prisma.user.findUnique({
		where: { id: user.userId },
	});

	if (currentUser?.roleId === roleId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot remove permissions from your own role",
		);
	}

	const rolePermission = await prisma.rolePermission.findUnique({
		where: {
			roleId_permissionId: { roleId, permissionId },
		},
	});

	if (!rolePermission) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Permission not assigned to this role",
		);
	}

	await prisma.rolePermission.delete({
		where: {
			roleId_permissionId: { roleId, permissionId },
		},
	});

	return { message: "Permission removed from role successfully" };
};

// Restore a built-in role's permissions to its seed template.
const resetRolePermissions = async (roleId: string, user: IRequestUser) => {
	const role = await prisma.role.findUnique({ where: { id: roleId } });
	if (!role) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
	}
	if (role.organizationId !== user.organizationId) {
		throw new AppError(httpStatus.FORBIDDEN, "You can only reset roles in your organization");
	}
	if (!role.isSystem) {
		throw new AppError(httpStatus.BAD_REQUEST, "Only built-in roles have default permissions");
	}

	const currentUser = await prisma.user.findUnique({ where: { id: user.userId } });
	if (currentUser?.roleId === roleId) {
		throw new AppError(httpStatus.FORBIDDEN, "Cannot reset the permissions of your own role");
	}

	const template = systemRoleTemplates.find((t) => t.name === role.name);
	if (!template) {
		throw new AppError(httpStatus.BAD_REQUEST, "No default permission set for this role");
	}

	const permissions = await prisma.permission.findMany({
		where: { name: { in: template.permissions } },
		select: { id: true },
	});

	await prisma.$transaction(async (tx) => {
		await tx.rolePermission.deleteMany({ where: { roleId } });
		await tx.rolePermission.createMany({
			data: permissions.map((p) => ({ roleId, permissionId: p.id })),
			skipDuplicates: true,
		});
		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.ASSIGN_PERMISSIONS,
				entity: "Role",
				entityId: roleId,
				metadata: { roleName: role.name, reset: true, total: permissions.length },
			},
		});
	});

	return prisma.role.findUnique({
		where: { id: roleId },
		include: { permissions: { include: { permission: true } } },
	});
};

export const RoleService = {
	createRole,
	getAllRoles,
	getRoleById,
	updateRole,
	deleteRole,
	getAllPermissions,
	getRolePermissions,
	assignPermissions,
	removePermission,
	resetRolePermissions,
};
