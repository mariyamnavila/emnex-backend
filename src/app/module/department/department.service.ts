import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IDepartmentCreatePayload,
	IDepartmentUpdatePayload,
} from "./department.interface";

const createDepartment = async (
	payload: IDepartmentCreatePayload,
	user: IRequestUser,
) => {
	// Check if department name already exists in this organization
	const existingDepartment = await prisma.department.findFirst({
		where: {
			name: payload.name,
			organizationId: user.organizationId,
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
			name: payload.name,
			description: payload.description,
			organizationId: user.organizationId,
		},
	});

	return department;
};

const getAllDepartments = async (user: IRequestUser) => {
	const departments = await prisma.department.findMany({
		where: {
			organizationId: user.organizationId,
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

	if (!department) {
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
	const department = await prisma.department.findUnique({
		where: { id },
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
	}

	if (department.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update departments in your organization",
		);
	}

	// Check if new name conflicts with existing department
	if (payload.name && payload.name !== department.name) {
		const existingDepartment = await prisma.department.findFirst({
			where: {
				name: payload.name,
				organizationId: user.organizationId,
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
		data: payload,
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

	await prisma.department.delete({ where: { id } });

	return { message: "Department deleted successfully" };
};

const getDepartmentEmployees = async (id: string, user: IRequestUser) => {
	const department = await prisma.department.findUnique({
		where: { id },
	});

	if (!department) {
		throw new AppError(httpStatus.NOT_FOUND, "Department not found");
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
