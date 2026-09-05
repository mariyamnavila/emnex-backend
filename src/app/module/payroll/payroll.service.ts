import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IPayrollGeneratePayload,
	IPayrollQueryParams,
} from "./payroll.interface";

const generatePayroll = async (
	payload: IPayrollGeneratePayload,
	user: IRequestUser,
) => {
	const { employeeId, periodStart, periodEnd, deductions = 0 } = payload;

	// Verify employee exists
	const employee = await prisma.employee.findFirst({
		where: {
			id: employeeId,
			organizationId: user.organizationId,
		},
		include: { user: true },
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	// Check if payroll already exists for this period
	const existingPayroll = await prisma.payroll.findUnique({
		where: {
			employeeId_periodStart_periodEnd: {
				employeeId,
				periodStart: new Date(periodStart),
				periodEnd: new Date(periodEnd),
			},
		},
	});

	if (existingPayroll) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Payroll already exists for this employee and period",
		);
	}

	// Get approved submissions for this period
	const approvedSubmissions = await prisma.workSubmission.findMany({
		where: {
			employeeId,
			status: "APPROVED",
			workDate: {
				gte: new Date(periodStart),
				lte: new Date(periodEnd),
			},
		},
	});

	// Calculate gross amount
	let grossAmount: number;

	if (employee.salaryType === "HOURLY") {
		// Sum hours from approved submissions
		const totalHours = approvedSubmissions.reduce(
			(sum, sub) => sum + Number(sub.hoursWorked),
			0,
		);
		grossAmount = totalHours * Number(employee.hourlyRate || 0);
	} else {
		// Monthly salary
		grossAmount = Number(employee.salary || 0);
	}

	// Calculate net amount
	const netAmount = grossAmount - deductions;

	// Create payroll
	const payroll = await prisma.payroll.create({
		data: {
			employeeId,
			organizationId: user.organizationId,
			periodStart: new Date(periodStart),
			periodEnd: new Date(periodEnd),
			grossAmount,
			deductions,
			netAmount,
			status: "DRAFT",
		},
		include: {
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	return payroll;
};

const getAllPayrolls = async (
	user: IRequestUser,
	query: IPayrollQueryParams,
) => {
	const { page = 1, limit = 10, status, employeeId } = query;

	const where: Record<string, unknown> = {
		organizationId: user.organizationId,
	};

	if (status) {
		where.status = status;
	}

	if (employeeId) {
		where.employeeId = employeeId;
	}

	const skip = (page - 1) * limit;

	const [payrolls, total] = await Promise.all([
		prisma.payroll.findMany({
			where,
			include: {
				employee: {
					include: {
						user: { omit: { password: true } },
					},
				},
				payment: true,
			},
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.payroll.count({ where }),
	]);

	return {
		payrolls,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getPayrollById = async (id: string, user: IRequestUser) => {
	const payroll = await prisma.payroll.findUnique({
		where: { id },
		include: {
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
			payment: true,
		},
	});

	if (!payroll) {
		throw new AppError(httpStatus.NOT_FOUND, "Payroll not found");
	}

	if (payroll.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view payrolls in your organization",
		);
	}

	return payroll;
};

const getMyPayrolls = async (user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This endpoint is for employees only",
		);
	}

	const payrolls = await prisma.payroll.findMany({
		where: { employeeId: employee.id },
		include: {
			payment: true,
		},
		orderBy: { createdAt: "desc" },
	});

	return payrolls;
};

const approvePayroll = async (id: string, user: IRequestUser) => {
	const payroll = await prisma.payroll.findUnique({
		where: { id },
	});

	if (!payroll) {
		throw new AppError(httpStatus.NOT_FOUND, "Payroll not found");
	}

	if (payroll.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only approve payrolls in your organization",
		);
	}

	if (payroll.status !== "DRAFT" && payroll.status !== "GENERATED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot approve payroll with ${payroll.status} status`,
		);
	}

	const updatedPayroll = await prisma.payroll.update({
		where: { id },
		data: { status: "APPROVED" },
		include: {
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	return updatedPayroll;
};

const rejectPayroll = async (
	id: string,
	user: IRequestUser,
) => {
	const payroll = await prisma.payroll.findUnique({
		where: { id },
	});

	if (!payroll) {
		throw new AppError(httpStatus.NOT_FOUND, "Payroll not found");
	}

	if (payroll.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only reject payrolls in your organization",
		);
	}

	if (payroll.status !== "DRAFT" && payroll.status !== "GENERATED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot reject payroll with ${payroll.status} status`,
		);
	}

	const updatedPayroll = await prisma.payroll.update({
		where: { id },
		data: { status: "REJECTED" },
		include: {
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	return updatedPayroll;
};

const getPayrollSummary = async (user: IRequestUser) => {
	const summary = await prisma.payroll.aggregate({
		where: { organizationId: user.organizationId },
		_sum: {
			grossAmount: true,
			deductions: true,
			netAmount: true,
		},
		_count: true,
	});

	const statusCounts = await prisma.payroll.groupBy({
		by: ["status"],
		where: { organizationId: user.organizationId },
		_count: true,
		_sum: {
			grossAmount: true,
			netAmount: true,
		},
	});

	return {
		totalPayrolls: summary._count,
		totalGross: summary._sum.grossAmount,
		totalDeductions: summary._sum.deductions,
		totalNet: summary._sum.netAmount,
		byStatus: statusCounts,
	};
};

export const PayrollService = {
	generatePayroll,
	getAllPayrolls,
	getPayrollById,
	getMyPayrolls,
	approvePayroll,
	rejectPayroll,
	getPayrollSummary,
};
