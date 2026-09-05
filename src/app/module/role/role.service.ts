import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
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

	return role;
};

const getAllRoles = async (user: IRequestUser) => {
	const roles = await prisma.role.findMany({
		where: {
			organizationId: user.organizationId,
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

	if (!role) {
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
	const role = await prisma.role.findUnique({
		where: { id },
	});

	if (!role) {
		throw new AppError(httpStatus.NOT_FOUND, "Role not found");
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
	if (payload.name && payload.name !== role.name) {
		const existingRole = await prisma.role.findFirst({
			where: {
				name: payload.name,
				organizationId: user.organizationId,
			},
		});

		if (existingRole) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Role name already exists in this organization",
			);
		}
	}

	const updatedRole = await prisma.role.update({
		where: { id },
		data: payload,
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

	await prisma.role.delete({ where: { id } });

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

	if (!role) {
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

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update permissions for roles in your organization",
		);
	}

	const permissionIds = [...new Set(payload.permissionIds)];

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

	if (role.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update permissions for roles in your organization",
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
