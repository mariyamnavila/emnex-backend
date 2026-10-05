import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog, toAuditValue } from "../../utils/auditLog";
import {
	validateEmployeeCanViewSubmissions,
	validateEmployeeCanWork,
} from "../../utils/employeeStatus";
import { getCallerEmployeeId, hasAnyPermission, SUBMISSION_MANAGE } from "../../utils/scope";
import type {
	ISubmissionCreatePayload,
	ISubmissionQueryParams,
	ISubmissionRejectPayload,
	ISubmissionUpdatePayload,
} from "./submission.interface";

const validSubmissionTransitions: Record<string, string[]> = {
	PENDING: ["APPROVED", "REJECTED"],
	APPROVED: [],
	REJECTED: [],
};

const DAILY_HOURS_CAP = 24;

// The employee's total non-rejected hours for a work date (across all tasks)
// can't exceed 24 — the 24h/submission cap alone allows multiple logs per day.
const assertDailyHoursWithinCap = async (
	employeeId: string,
	workDate: string | Date,
	newHours: number,
	excludeSubmissionId?: string,
) => {
	const day = new Date(workDate);
	const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
	const dayEnd = new Date(dayStart);
	dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

	const existing = await prisma.workSubmission.aggregate({
		where: {
			employeeId,
			status: { not: "REJECTED" },
			workDate: { gte: dayStart, lt: dayEnd },
			...(excludeSubmissionId ? { id: { not: excludeSubmissionId } } : {}),
		},
		_sum: { hoursWorked: true },
	});
	const already = Number(existing._sum.hoursWorked ?? 0);
	if (already + newHours > DAILY_HOURS_CAP) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`You've already logged ${already} h for that day; the total can't exceed ${DAILY_HOURS_CAP} h`,
		);
	}
};

const createSubmission = async (
	payload: ISubmissionCreatePayload,
	user: IRequestUser,
) => {
	const { taskId, description, hoursWorked, workDate } = payload;

	// Find employee record for this user
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		throw new AppError(httpStatus.FORBIDDEN, "Employee record not found");
	}

	validateEmployeeCanWork(employee.status);

	// Verify task exists and belongs to this employee
	const task = await prisma.task.findUnique({
		where: { id: taskId },
		include: { project: true },
	});

	if (!task || task.deletedAt || task.project.deletedAt) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.status === "COMPLETED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot submit work for a completed task",
		);
	}

	if (
		task.project.status === "COMPLETED" ||
		task.project.status === "CANCELLED"
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot submit work for a ${task.project.status.toLowerCase()} project`,
		);
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Task does not belong to your organization",
		);
	}

	if (task.employeeId !== employee.id) {
		throw new AppError(httpStatus.FORBIDDEN, "Task is not assigned to you");
	}

	// A day has 24 hours — cap the employee's total (non-rejected) hours for the
	// work date across all tasks, not just per submission
	await assertDailyHoursWithinCap(employee.id, workDate, Number(hoursWorked));

	const submission = await prisma.workSubmission.create({
		data: {
			taskId,
			employeeId: employee.id,
			description,
			hoursWorked,
			workDate: new Date(workDate),
		},
		include: {
			task: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	createAuditLog({
		user,
		action: AuditAction.SUBMIT_WORK,
		entity: "WorkSubmission",
		entityId: submission.id,
		metadata: {
			taskTitle: submission.task.title,
			employeeName: submission.employee.user.name,
			hoursWorked: toAuditValue(submission.hoursWorked),
			workDate: toAuditValue(submission.workDate),
		},
	});

	return submission;
};

const getAllSubmissions = async (
	user: IRequestUser,
	query: ISubmissionQueryParams,
) => {
	const {
		page = 1,
		limit = 10,
		status,
		taskId,
		employeeId,
		sortOrder = "desc",
	} = query;

	const where: Record<string, unknown> = {
		task: {
			project: { organizationId: user.organizationId },
		},
	};

	if (status) {
		where.status = status;
	}

	if (taskId) {
		where.taskId = taskId;
	}

	if (employeeId) {
		where.employeeId = employeeId;
	}

	// Plain employees (no review permission) only ever see their own submissions
	if (!hasAnyPermission(user, SUBMISSION_MANAGE)) {
		where.employeeId = (await getCallerEmployeeId(user)) ?? "__none__";
	}

	const skip = (page - 1) * limit;

	const [submissions, total] = await Promise.all([
		prisma.workSubmission.findMany({
			where,
			include: {
				task: { include: { project: { select: { id: true, name: true } } } },
				employee: {
					include: {
						user: { omit: { password: true } },
					},
				},
			},
			skip,
			take: limit,
			orderBy: { createdAt: sortOrder },
		}),
		prisma.workSubmission.count({ where }),
	]);

	return {
		submissions,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getSubmissionById = async (id: string, user: IRequestUser) => {
	const submission = await prisma.workSubmission.findUnique({
		where: { id },
		include: {
			task: {
				include: { project: true },
			},
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view submissions in your organization",
		);
	}

	// Plain employees (no review permission) can only view their own
	if (!hasAnyPermission(user, SUBMISSION_MANAGE)) {
		const employeeId = await getCallerEmployeeId(user);
		if (!employeeId || submission.employeeId !== employeeId) {
			throw new AppError(httpStatus.FORBIDDEN, "You can only view your own submissions");
		}
	}

	return submission;
};

const updateSubmission = async (
	id: string,
	payload: ISubmissionUpdatePayload,
	user: IRequestUser,
) => {
	const { description, hoursWorked, workDate } = payload;

	const submission = await prisma.workSubmission.findUnique({
		where: { id },
		include: {
			task: { include: { project: true } },
			employee: true,
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update submissions in your organization",
		);
	}

	// Only the employee who created it can update, and only if PENDING
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee || submission.employeeId !== employee.id) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update your own submissions",
		);
	}

	if (submission.status !== "PENDING") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Can only update submissions with PENDING status",
		);
	}

	// Re-check the 24h/day cap if the hours or date change (ignoring this row)
	if (hoursWorked !== undefined || workDate !== undefined) {
		await assertDailyHoursWithinCap(
			employee.id,
			workDate ?? submission.workDate,
			Number(hoursWorked ?? submission.hoursWorked),
			submission.id,
		);
	}

	const updatedSubmission = await prisma.workSubmission.update({
		where: { id },
		data: {
			description,
			hoursWorked,
			workDate: workDate ? new Date(workDate) : undefined,
		},
		include: {
			task: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	return updatedSubmission;
};

const approveSubmission = async (id: string, user: IRequestUser) => {
	const submission = await prisma.workSubmission.findUnique({
		where: { id },
		include: {
			task: { include: { project: true } },
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only approve submissions in your organization",
		);
	}

	// Prevent self-approval
	const currentUserEmployee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (currentUserEmployee && currentUserEmployee.id === submission.employeeId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Cannot approve your own submission",
		);
	}

	// Validate status transition
	const allowed = validSubmissionTransitions[submission.status];
	if (!allowed || !allowed.includes("APPROVED")) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot approve submission with ${submission.status} status`,
		);
	}

	// Reviewing a work log never changes the task's own status
	const result = await prisma.$transaction(async (tx) => {
		const updatedSubmission = await tx.workSubmission.update({
			where: { id },
			data: {
				status: "APPROVED",
				reviewedBy: user.userId,
				reviewedAt: new Date(),
			},
			include: {
				task: true,
				employee: {
					include: {
						user: { omit: { password: true } },
					},
				},
			},
		});

		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.APPROVE_WORK,
				entity: "WorkSubmission",
				entityId: id,
				metadata: {
					taskTitle: updatedSubmission.task.title,
					employeeName: updatedSubmission.employee.user.name,
					hoursWorked: toAuditValue(updatedSubmission.hoursWorked),
					workDate: toAuditValue(updatedSubmission.workDate),
				},
			},
		});

		return updatedSubmission;
	});

	return result;
};

const rejectSubmission = async (
	id: string,
	payload: ISubmissionRejectPayload,
	user: IRequestUser,
) => {
	const { reason } = payload;

	const submission = await prisma.workSubmission.findUnique({
		where: { id },
		include: {
			task: { include: { project: true } },
		},
	});

	if (!submission) {
		throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
	}

	if (submission.task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only reject submissions in your organization",
		);
	}

	// Prevent self-rejection (mirrors the self-approval guard)
	const reviewer = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});
	if (reviewer && submission.employeeId === reviewer.id) {
		throw new AppError(httpStatus.FORBIDDEN, "Cannot reject your own submission");
	}

	// Validate status transition
	const allowed = validSubmissionTransitions[submission.status];
	if (!allowed || !allowed.includes("REJECTED")) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot reject submission with ${submission.status} status`,
		);
	}

	const result = await prisma.$transaction(async (tx) => {
		const updatedSubmission = await tx.workSubmission.update({
			where: { id },
			data: {
				status: "REJECTED",
				reviewedBy: user.userId,
				reviewedAt: new Date(),
				reviewNote: reason,
			},
			include: {
				task: true,
				employee: {
					include: {
						user: { omit: { password: true } },
					},
				},
			},
		});

		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.REJECT_WORK,
				entity: "WorkSubmission",
				entityId: id,
				metadata: {
					taskTitle: updatedSubmission.task.title,
					employeeName: updatedSubmission.employee.user.name,
					hoursWorked: toAuditValue(updatedSubmission.hoursWorked),
					workDate: toAuditValue(updatedSubmission.workDate),
					reason,
				},
			},
		});

		return updatedSubmission;
	});

	return result;
};

const getMySubmissions = async (user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This endpoint is for employees only",
		);
	}

	validateEmployeeCanViewSubmissions(employee.status);

	const submissions = await prisma.workSubmission.findMany({
		where: { employeeId: employee.id },
		include: {
			task: { include: { project: { select: { id: true, name: true } } } },
		},
		orderBy: { createdAt: "desc" },
	});

	return submissions;
};

export const SubmissionService = {
	createSubmission,
	getAllSubmissions,
	getSubmissionById,
	updateSubmission,
	approveSubmission,
	rejectSubmission,
	getMySubmissions,
};
