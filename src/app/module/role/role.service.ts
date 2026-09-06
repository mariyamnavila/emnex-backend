import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog } from "../../utils/auditLog";
import type {
	IPermissionAssignPayload,
	IRoleCreatePayload,
	IRoleUpdatePayload,
} from "./role.interface";

const createRole = async (payload: IRoleCreatePayload, user: IRequestUser) => {
	const { name, description } = payload;

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

	const role = await prisma.role.create({
		data: {
			name: name,
			description: description,
			organizationId: user.organizationId,
		},
	});

	createAuditLog({
		user,
		action: AuditAction.CREATE_ROLE,
		entity: "Role",
		entityId: role.id,
		metadata: { name },
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
		metadata: { name, description },
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

	const permissionIds = [...new Set(payload.permissionIds)];

	// Get user's own permissions to validate they can only assign what they have
	const userWithRole = await prisma.user.findUnique({
		where: { id: user.userId },
		include: {
			role: {
				include: {
					permissions: {
						select: { permissionId: true },
					},
				},
			},
		},
	});

	const userPermissionIds = new Set(
		userWithRole?.role.permissions.map((rp) => rp.permissionId) || [],
	);

	// Check if user is trying to assign permissions they don't have
	const unauthorizedPerms = permissionIds.filter(
		(permId) => !userPermissionIds.has(permId),
	);

	if (unauthorizedPerms.length > 0) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`You cannot assign permissions you don't have: ${unauthorizedPerms.join(", ")}`,
		);
	}

	const permissions = await prisma.permission.findMany({
		where: {
			id: {
				in: permissionIds,
			},
		},
		select: {
			id: true,
		},
	});

	if (permissions.length !== permissionIds.length) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"One or more permission IDs are invalid",
		);
	}

	await prisma.$transaction(async (tx) => {
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
				metadata: { permissionIds },
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
};
