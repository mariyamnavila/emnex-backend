import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog } from "../../utils/auditLog";
import type {
	IDepartmentCreatePayload,
	IDepartmentUpdatePayload,
} from "./department.interface";

const createDepartment = async (
	payload: IDepartmentCreatePayload,
	user: IRequestUser,
) => {
	const { name, description } = payload;

	// Check if department name already exists in this organization
	const existingDepartment = await prisma.department.findFirst({
		where: {
			name,
			organizationId: user.organizationId,
			deletedAt: null,
		},
	});

	if (existingDepartment) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Department name already exists in this organization",
		);
	}

	const department = await prisma.department.create({
		data: {
			name,
			description,
			organizationId: user.organizationId,
		},
	});

	createAuditLog({
		user,
		action: AuditAction.CREATE_DEPARTMENT,
		entity: "Department",
		entityId: department.id,
		metadata: { name },
	});

	return department;
};

const getAllDepartments = async (user: IRequestUser) => {
	const departments = await prisma.department.findMany({
		where: {
			organizationId: user.organizationId,
			deletedAt: null,
		},
		include: {
			_count: {
				select: {
					employees: true,
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return departments;
};

const getDepartmentById = async (id: string, user: IRequestUser) => {
	const department = await prisma.department.findUnique({
		where: { id },
		include: {
			employees: {
				include: {
					user: {
						omit: { password: true },
					},
				},
			},
			_count: {
				select: {
					employees: true,
				},
			},
		},
	});

	if (!department || department.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (department.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view departments in your organization",
		);
	}

	return department;
};

const updateDepartment = async (
	id: string,
	payload: IDepartmentUpdatePayload,
	user: IRequestUser,
) => {
	const { name, description } = payload;

	const department = await prisma.department.findUnique({
		where: { id },
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (department.deletedAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot modify deleted department",
		);
	}

	if (department.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update departments in your organization",
		);
	}

	// Check if new name conflicts with existing department
	if (name && name !== department.name) {
		const existingDepartment = await prisma.department.findFirst({
			where: {
				name,
				organizationId: user.organizationId,
				deletedAt: null,
			},
		});

		if (existingDepartment) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Department name already exists in this organization",
			);
		}
	}

	const updatedDepartment = await prisma.department.update({
		where: { id },
		data: { name, description },
	});

	createAuditLog({
		user,
		action: AuditAction.UPDATE_DEPARTMENT,
		entity: "Department",
		entityId: id,
		metadata: { name, description },
	});

	return updatedDepartment;
};

const deleteDepartment = async (id: string, user: IRequestUser) => {
	const department = await prisma.department.findUnique({
		where: { id },
		include: {
			_count: {
				select: { employees: true },
			},
		},
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (department.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only delete departments in your organization",
		);
	}

	if (department._count.employees > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete department with assigned employees. Reassign employees first.",
		);
	}

	await prisma.department.update({
		where: { id },
		data: { deletedAt: new Date() },
	});

	createAuditLog({
		user,
		action: AuditAction.DELETE_DEPARTMENT,
		entity: "Department",
		entityId: id,
	});

	return { message: "Department deleted successfully" };
};

const getDepartmentEmployees = async (id: string, user: IRequestUser) => {
	const department = await prisma.department.findUnique({
		where: { id },
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (department.deletedAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot view employees in deleted department",
		);
	}

	if (department.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view departments in your organization",
		);
	}

	const employees = await prisma.employee.findMany({
		where: {
			departmentId: id,
			organizationId: user.organizationId,
		},
		include: {
			user: {
				omit: { password: true },
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return employees;
};

export const DepartmentService = {
	createDepartment,
	getAllDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
	getDepartmentEmployees,
};
