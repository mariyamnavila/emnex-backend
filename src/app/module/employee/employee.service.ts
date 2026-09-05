import bcrypt from "bcryptjs";
import crypto from "crypto";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { sendEmployeeWelcomeEmail } from "../../lib/email";
import { AppError } from "../../utils/AppError";
import type {
	IEmployeeCreatePayload,
	IEmployeeQueryParams,
	IEmployeeUpdatePayload,
} from "./employee.interface";
import config from "../../config";

const generateEmployeeCode = async (organizationId: string) => {
	const lastEmployee = await prisma.employee.findFirst({
		where: { organizationId },
		orderBy: { createdAt: "desc" },
	});

	if (!lastEmployee) {
		return "EMP-001";
	}

	const lastCode = lastEmployee.employeeCode;
	const lastNumber = Number.parseInt(lastCode.split("-")[1], 10);
	const nextNumber = lastNumber + 1;
	return `EMP-${nextNumber.toString().padStart(3, "0")}`;
};

const generateRandomPassword = () => {
	return crypto.randomBytes(12).toString("base64url").slice(0, 12);
};

const createEmployee = async (
	payload: IEmployeeCreatePayload,
	user: IRequestUser,
) => {
	// Check if email already exists
	const existingUser = await prisma.user.findUnique({
		where: { email: payload.email },
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	// Verify role exists in this organization
	const role = await prisma.role.findFirst({
		where: {
			id: payload.roleId,
			organizationId: user.organizationId,
		},
	});

	if (!role) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Role not found in this organization",
		);
	}

	const employeeCode = await generateEmployeeCode(user.organizationId);

	// Generate random temporary password
	const temporaryPassword = generateRandomPassword();
	const hashedPassword = await bcrypt.hash(
		temporaryPassword,
		Number(config.bcrypt_salt_rounds),
	);

	// Create user and employee in transaction
	const result = await prisma.$transaction(async (tx) => {
		const newUser = await tx.user.create({
			data: {
				name: payload.name,
				email: payload.email,
				password: hashedPassword,
				organizationId: user.organizationId,
				roleId: payload.roleId,
				mustChangePassword: true,
			},
			omit: { password: true },
		});

		const employee = await tx.employee.create({
			data: {
				userId: newUser.id,
				organizationId: user.organizationId,
				employeeCode,
				departmentId: payload.departmentId,
				jobTitle: payload.jobTitle,
				salaryType: payload.salaryType,
				salary: payload.salary,
				hourlyRate: payload.hourlyRate,
				joiningDate: new Date(payload.joiningDate),
			},
			include: {
				user: { omit: { password: true } },
				department: true,
			},
		});

		return employee;
	});

	// Get organization name for email
	const organization = await prisma.organization.findUnique({
		where: { id: user.organizationId },
	});

	// Send welcome email (non-blocking)
	sendEmployeeWelcomeEmail({
		to: payload.email,
		name: payload.name,
		email: payload.email,
		temporaryPassword,
		roleName: role.name,
		organizationName: organization?.name || "EmNex",
	}).catch(() => {});

	return {
		employee: result,
		temporaryPassword,
	};
};

const getAllEmployees = async (
	user: IRequestUser,
	query: IEmployeeQueryParams,
) => {
	const {
		page = 1,
		limit = 10,
		search,
		departmentId,
		status,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = query;

	const where: Record<string, unknown> = {
		organizationId: user.organizationId,
	};

	if (search) {
		where.OR = [
			{ user: { name: { contains: search, mode: "insensitive" } } },
			{ user: { email: { contains: search, mode: "insensitive" } } },
			{ employeeCode: { contains: search, mode: "insensitive" } },
			{ jobTitle: { contains: search, mode: "insensitive" } },
		];
	}

	if (departmentId) {
		where.departmentId = departmentId;
	}

	if (status) {
		where.status = status;
	}

	const skip = (page - 1) * limit;

	const [employees, total] = await Promise.all([
		prisma.employee.findMany({
			where,
			include: {
				user: { omit: { password: true } },
				department: true,
			},
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.employee.count({ where }),
	]);

	return {
		employees,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getEmployeeById = async (id: string, user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
		include: {
			user: { omit: { password: true } },
			department: true,
			_count: {
				select: {
					tasks: true,
					submissions: true,
					payrolls: true,
					payments: true,
				},
			},
		},
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	if (employee.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view employees in your organization",
		);
	}

	return employee;
};

const updateEmployee = async (
	id: string,
	payload: IEmployeeUpdatePayload,
	user: IRequestUser,
) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	if (employee.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update employees in your organization",
		);
	}

	const updatedEmployee = await prisma.employee.update({
		where: { id },
		data: payload,
		include: {
			user: { omit: { password: true } },
			department: true,
		},
	});

	return updatedEmployee;
};

const deleteEmployee = async (id: string, user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	if (employee.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only delete employees in your organization",
		);
	}

	// Soft delete - set status to TERMINATED
	await prisma.employee.update({
		where: { id },
		data: { status: "TERMINATED" },
	});

	return { message: "Employee terminated successfully" };
};

const getEmployeeStats = async (id: string, user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	if (employee.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view employees in your organization",
		);
	}

	const [
		totalTasks,
		completedTasks,
		totalSubmissions,
		approvedSubmissions,
		totalPayrolls,
		paidPayrolls,
		totalPayments,
	] = await Promise.all([
		prisma.task.count({ where: { employeeId: id } }),
		prisma.task.count({ where: { employeeId: id, status: "COMPLETED" } }),
		prisma.workSubmission.count({ where: { employeeId: id } }),
		prisma.workSubmission.count({
			where: { employeeId: id, status: "APPROVED" },
		}),
		prisma.payroll.count({ where: { employeeId: id } }),
		prisma.payroll.count({ where: { employeeId: id, status: "PAID" } }),
		prisma.payment.count({ where: { employeeId: id } }),
	]);

	return {
		totalTasks,
		completedTasks,
		totalSubmissions,
		approvedSubmissions,
		totalPayrolls,
		paidPayrolls,
		totalPayments,
	};
};

const resendCredentials = async (id: string, user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
		include: {
			user: {
				include: { role: true },
			},
		},
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	if (employee.organizationId !== user.organizationId) {
		throw new AppError(httpStatus.FORBIDDEN, "You can only resend credentials for employees in your organization");
	}

	// Generate new temporary password
	const temporaryPassword = generateRandomPassword();
	const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

	// Update user password + mustChangePassword
	await prisma.user.update({
		where: { id: employee.userId },
		data: {
			password: hashedPassword,
			mustChangePassword: true,
		},
	});

	// Get organization name
	const organization = await prisma.organization.findUnique({
		where: { id: user.organizationId },
	});

	// Send email
	await sendEmployeeWelcomeEmail({
		to: employee.user.email,
		name: employee.user.name,
		email: employee.user.email,
		temporaryPassword,
		roleName: employee.user.role.name,
		organizationName: organization?.name || "EmNex",
	});

	return { message: "Credentials resent successfully" };
};

export const EmployeeService = {
	createEmployee,
	getAllEmployees,
	getEmployeeById,
	updateEmployee,
	deleteEmployee,
	getEmployeeStats,
	resendCredentials,
};
