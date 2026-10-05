import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { checkUserPermission } from "../../middleware/checkPermission";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog, toAuditValue } from "../../utils/auditLog";
import type {
	IPayrollGeneratePayload,
	IPayrollQueryParams,
} from "./payroll.interface";

const toNumber = (value: unknown): number => {
	if (typeof value === "object" && value !== null && "toString" in value) {
		return Number(value.toString());
	}
	return Number(value);
};

const formatPayroll = (payroll: any) => ({
	...payroll,
	grossAmount: toNumber(payroll.grossAmount),
	deductions: toNumber(payroll.deductions),
	netAmount: toNumber(payroll.netAmount),
});

const generatePayroll = async (
	payload: IPayrollGeneratePayload,
	user: IRequestUser,
) => {
	const { employeeId, periodStart, periodEnd } = payload;
	// Round like gross/net so the stored gross − deductions === net to the cent
	const deductions = Math.round((payload.deductions ?? 0) * 100) / 100;

	// Verify employee exists
	const employee = await prisma.employee.findFirst({
		where: {
			id: employeeId,
			organizationId: user.organizationId,
		},
		include: { user: true },
	});

	if (new Date(periodStart) >= new Date(periodEnd)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Period start date must be before period end date",
		);
	}

	if (new Date(periodStart) > new Date()) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot generate payroll for a period that hasn't started yet",
		);
	}

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee not found");
	}

	if (employee.status === "TERMINATED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot generate payroll for a terminated employee",
		);
	}

	// Prevent self-generation
	const currentUserEmployee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (currentUserEmployee && currentUserEmployee.id === employeeId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot generate payroll for yourself",
		);
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

	// A rejected payroll can be regenerated (we reset that row below); any other
	// status means a live payroll already exists for this period.
	if (existingPayroll && existingPayroll.status !== "REJECTED") {
		throw new AppError(
			httpStatus.CONFLICT,
			"Payroll already exists for this employee and period",
		);
	}

	// Reject any OTHER (non-rejected) payroll whose period overlaps this one —
	// overlapping periods would pay the same approved hours twice.
	const overlapping = await prisma.payroll.findFirst({
		where: {
			employeeId,
			status: { not: "REJECTED" },
			periodStart: { lte: new Date(periodEnd) },
			periodEnd: { gte: new Date(periodStart) },
			...(existingPayroll ? { id: { not: existingPayroll.id } } : {}),
		},
		select: { periodStart: true, periodEnd: true },
	});
	if (overlapping) {
		throw new AppError(
			httpStatus.CONFLICT,
			`This period overlaps an existing payroll (${overlapping.periodStart.toISOString().slice(0, 10)} – ${overlapping.periodEnd.toISOString().slice(0, 10)}) for this employee`,
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

	const toCents = (amount: number) => Math.round(amount * 100) / 100;

	// Calculate gross amount
	let grossAmount: number;
	let approvedHours: number | null = null;

	// A manual amount (PTO / bonus / special case) overrides the hours/salary calc
	if (payload.grossAmount !== undefined) {
		grossAmount = toCents(payload.grossAmount);
		if (employee.salaryType === "HOURLY") {
			approvedHours = approvedSubmissions.reduce(
				(sum, sub) => sum + Number(sub.hoursWorked),
				0,
			);
		}
	} else if (employee.salaryType === "HOURLY") {
		const hourlyRate = Number(employee.hourlyRate || 0);
		if (hourlyRate <= 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This employee has no hourly rate set",
			);
		}

		// Sum hours from approved submissions
		const totalHours = approvedSubmissions.reduce(
			(sum, sub) => sum + Number(sub.hoursWorked),
			0,
		);
		if (totalHours === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`${employee.user.name} has no approved work hours in this period`,
			);
		}

		approvedHours = totalHours;
		grossAmount = toCents(totalHours * hourlyRate);
	} else {
		grossAmount = toCents(Number(employee.salary || 0));
		if (grossAmount <= 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"This employee has no monthly salary set",
			);
		}
	}

	if (deductions > grossAmount) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Deductions (${deductions}) can't be more than gross pay (${grossAmount})`,
		);
	}

	// Calculate net amount
	const netAmount = toCents(grossAmount - deductions);

	const include = {
		employee: {
			include: {
				user: { omit: { password: true } },
			},
		},
	};

	// Regenerate reuses the rejected row; otherwise create a fresh draft
	const payroll = existingPayroll
		? await prisma.payroll.update({
				where: { id: existingPayroll.id },
				data: { grossAmount, deductions, netAmount, status: "DRAFT" },
				include,
			})
		: await prisma.payroll.create({
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
				include,
			});

	createAuditLog({
		user,
		action: AuditAction.GENERATE_PAYROLL,
		entity: "Payroll",
		entityId: payroll.id,
		metadata: {
			employeeName: payroll.employee.user.name,
			employeeCode: payroll.employee.employeeCode,
			periodStart: toAuditValue(payroll.periodStart),
			periodEnd: toAuditValue(payroll.periodEnd),
			salaryType: employee.salaryType,
			approvedHours,
			grossAmount,
			deductions,
			netAmount,
		},
	});

	return formatPayroll(payroll);
};

const getAllPayrolls = async (
	user: IRequestUser,
	query: IPayrollQueryParams,
) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const { status, employeeId } = query;

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
		payrolls: payrolls.map(formatPayroll),
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

	// If user has only view_own permission, they can only see their own payroll
	const hasFullView = await checkUserPermission(user.userId, "payroll.view");
	if (!hasFullView) {
		const employee = await prisma.employee.findUnique({
			where: { userId: user.userId },
		});

		if (!employee || payroll.employeeId !== employee.id) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You can only view your own payroll",
			);
		}
	}

	return formatPayroll(payroll);
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

	return payrolls.map(formatPayroll);
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

	// Prevent self-approval
	const currentUserEmployee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (currentUserEmployee && currentUserEmployee.id === payroll.employeeId) {
		throw new AppError(httpStatus.FORBIDDEN, "Cannot approve your own payroll");
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

	createAuditLog({
		user,
		action: AuditAction.APPROVE_PAYROLL,
		entity: "Payroll",
		entityId: id,
		metadata: {
			employeeName: updatedPayroll.employee.user.name,
			periodStart: toAuditValue(payroll.periodStart),
			periodEnd: toAuditValue(payroll.periodEnd),
			netAmount: toAuditValue(payroll.netAmount),
		},
	});

	return formatPayroll(updatedPayroll);
};

const rejectPayroll = async (id: string, user: IRequestUser) => {
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

	createAuditLog({
		user,
		action: AuditAction.REJECT_PAYROLL,
		entity: "Payroll",
		entityId: id,
		metadata: {
			employeeName: updatedPayroll.employee.user.name,
			periodStart: toAuditValue(payroll.periodStart),
			periodEnd: toAuditValue(payroll.periodEnd),
			netAmount: toAuditValue(payroll.netAmount),
		},
	});

	return formatPayroll(updatedPayroll);
};

export const PayrollService = {
	generatePayroll,
	getAllPayrolls,
	getPayrollById,
	getMyPayrolls,
	approvePayroll,
	rejectPayroll,
};
