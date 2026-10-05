import bcrypt from "bcryptjs";
import crypto from "crypto";
import httpStatus from "http-status";
import config from "../../config";
import type { IRequestUser } from "../../interfaces";
import { sendEmployeeWelcomeEmail } from "../../lib/email";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog, diffFields } from "../../utils/auditLog";
import type {
	IEmployeeCreatePayload,
	IEmployeeQueryParams,
	IEmployeeUpdatePayload,
} from "./employee.interface";

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
	const {
		name,
		email,
		roleId,
		departmentId,
		jobTitle,
		salaryType,
		salary,
		hourlyRate,
		joiningDate,
	} = payload;

	// Check if email already exists
	const existingUser = await prisma.user.findUnique({
		where: { email },
	});

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	// Verify role exists in this organization and is not deleted
	const role = await prisma.role.findFirst({
		where: {
			id: roleId,
			organizationId: user.organizationId,
			deletedAt: null,
		},
	});

	if (!role) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Role not found in this organization",
		);
	}

	// Verify department exists if provided
	if (departmentId) {
		const department = await prisma.department.findFirst({
			where: {
				id: departmentId,
				organizationId: user.organizationId,
			},
		});

		if (!department) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"Department not found in this organization",
			);
		}
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
				name,
				email,
				password: hashedPassword,
				organizationId: user.organizationId,
				roleId,
				mustChangePassword: true,
			},
			omit: { password: true },
		});

		const employee = await tx.employee.create({
			data: {
				userId: newUser.id,
				organizationId: user.organizationId,
				employeeCode,
				departmentId,
				jobTitle,
				salaryType,
				salary,
				hourlyRate,
				joiningDate: new Date(joiningDate),
			},
			include: {
				user: { omit: { password: true } },
				department: true,
			},
		});

		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.CREATE_EMPLOYEE,
				entity: "Employee",
				entityId: employee.id,
				metadata: {
					employeeName: name,
					email,
					employeeCode,
					roleName: role.name,
					departmentName: employee.department?.name ?? null,
					jobTitle,
					salaryType,
					salary: salary ?? null,
					hourlyRate: hourlyRate ?? null,
				},
			},
		});

		return employee;
	});

	// Get organization name for email
	const organization = await prisma.organization.findUnique({
		where: { id: user.organizationId },
	});

	// Send welcome email
	try {
		await sendEmployeeWelcomeEmail({
			to: payload.email,
			name: payload.name,
			email: payload.email,
			temporaryPassword,
			roleName: role.name,
			organizationName: organization?.name || "EmNex",
		});
	} catch (error) {
		console.error("Failed to send welcome email:", error);
	}

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

const isNegativeStatus = (status?: string) => {
	return (
		status === "TERMINATED" || status === "SUSPENDED" || status === "INACTIVE"
	);
};

const updateEmployee = async (
	id: string,
	payload: IEmployeeUpdatePayload,
	user: IRequestUser,
) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
		include: {
			user: {
				include: {
					role: true,
				},
			},
			department: true,
		},
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

	const targetIsAdmin = employee.user.role.name === "ADMIN";

	// Prevent self-status change to any negative status
	if (employee.userId === user.userId && isNegativeStatus(payload.status)) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot change your own status to a negative state",
		);
	}

	// Prevent anyone from changing admin's status to a negative state
	if (targetIsAdmin && isNegativeStatus(payload.status)) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot change the admin's status to a negative state",
		);
	}

	// Terminating is a soft delete, so it needs the delete permission — not just
	// update (which the status change otherwise requires)
	if (payload.status === "TERMINATED" && !user.permissions.includes("employee.delete")) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Terminating an employee requires the employee delete permission",
		);
	}

	if (payload.departmentId) {
		const department = await prisma.department.findFirst({
			where: {
				id: payload.departmentId,
				organizationId: user.organizationId,
				deletedAt: null,
			},
		});

		if (!department) {
			throw new AppError(
				httpStatus.NOT_FOUND,
				"Department not found in this organization",
			);
		}
	}

	// Reassigning a role is privileged: needs role.update, can't target yourself
	// or the admin, and you can't grant a role more powerful than your own.
	if (payload.roleId && payload.roleId !== employee.user.roleId) {
		if (!user.permissions.includes("role.update")) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Changing an employee's role requires the role update permission",
			);
		}
		if (employee.userId === user.userId) {
			throw new AppError(httpStatus.FORBIDDEN, "You can't change your own role");
		}
		if (targetIsAdmin) {
			throw new AppError(httpStatus.FORBIDDEN, "Can't change the admin's role");
		}

		const role = await prisma.role.findFirst({
			where: { id: payload.roleId, organizationId: user.organizationId, deletedAt: null },
			include: { permissions: { include: { permission: true } } },
		});
		if (!role) {
			throw new AppError(httpStatus.NOT_FOUND, "Role not found in this organization");
		}

		const missing = role.permissions
			.map((rp) => rp.permission.name)
			.filter((name) => !user.permissions.includes(name));
		if (missing.length > 0) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				`You can't assign a role with permissions you don't have: ${missing.join(", ")}`,
			);
		}

		await prisma.user.update({ where: { id: employee.userId }, data: { roleId: payload.roleId } });
	}

	const updatedEmployee = await prisma.employee.update({
		where: { id },
		// roleId lives on the user (handled above), so keep it out of the employee update
		data: {
			departmentId: payload.departmentId,
			jobTitle: payload.jobTitle,
			salaryType: payload.salaryType,
			salary: payload.salary,
			hourlyRate: payload.hourlyRate,
			status: payload.status,
		},
		include: {
			user: { omit: { password: true } },
			department: true,
		},
	});

	const auditFields = (e: typeof updatedEmployee) => ({
		department: e.department?.name ?? null,
		jobTitle: e.jobTitle,
		salaryType: e.salaryType,
		salary: e.salary,
		hourlyRate: e.hourlyRate,
		status: e.status,
	});
	const changes = diffFields(auditFields(employee), auditFields(updatedEmployee), [
		"department",
		"jobTitle",
		"salaryType",
		"salary",
		"hourlyRate",
		"status",
	]);
	const changedFields = Object.keys(changes);

	if (changedFields.length > 0) {
		createAuditLog({
			user,
			action:
				changedFields.length === 1 && changes.status
					? AuditAction.CHANGE_EMPLOYEE_STATUS
					: AuditAction.UPDATE_EMPLOYEE,
			entity: "Employee",
			entityId: id,
			metadata: {
				employeeName: employee.user.name,
				employeeCode: employee.employeeCode,
				changes,
			},
		});
	}

	return updatedEmployee;
};

const deleteEmployee = async (id: string, user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { id },
		include: {
			user: {
				include: {
					role: true,
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
			"You can only delete employees in your organization",
		);
	}

	// Prevent self-deletion
	if (employee.userId === user.userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot terminate your own account",
		);
	}

	// Prevent terminating admin
	if (employee.user.role.name === "ADMIN") {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot terminate the admin account",
		);
	}

	// Soft delete - set status to TERMINATED
	await prisma.employee.update({
		where: { id },
		data: { status: "TERMINATED" },
	});

	createAuditLog({
		user,
		action: AuditAction.DELETE_EMPLOYEE,
		entity: "Employee",
		entityId: id,
		metadata: {
			employeeName: employee.user.name,
			employeeCode: employee.employeeCode,
			from: employee.status,
			to: "TERMINATED",
		},
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
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only resend credentials for employees in your organization",
		);
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

	// Returned so the admin can share it if the email doesn't arrive (same as create)
	return { message: "Credentials resent successfully", temporaryPassword };
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
