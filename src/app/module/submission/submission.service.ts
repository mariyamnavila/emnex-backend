import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog } from "../../utils/auditLog";
import {
	validateEmployeeCanViewSubmissions,
	validateEmployeeCanWork,
} from "../../utils/employeeStatus";
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
		metadata: { taskId, employeeId: employee.id, hoursWorked },
	});

	return submission;
};

const getAllSubmissions = async (
	user: IRequestUser,
	query: ISubmissionQueryParams,
) => {
	const { page = 1, limit = 10, status, taskId, employeeId } = query;

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

	const skip = (page - 1) * limit;

	const [submissions, total] = await Promise.all([
		prisma.workSubmission.findMany({
			where,
			include: {
				task: true,
				employee: {
					include: {
						user: { omit: { password: true } },
					},
				},
			},
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
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

	// Transaction: approve submission + update task status
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

		// Update task status to SUBMITTED
		await tx.task.update({
			where: { id: submission.taskId },
			data: { status: "SUBMITTED" },
		});

		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.APPROVE_WORK,
				entity: "WorkSubmission",
				entityId: id,
				metadata: {
					taskId: submission.taskId,
					employeeId: submission.employeeId,
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

		// Update task status to REJECTED
		await tx.task.update({
			where: { id: submission.taskId },
			data: { status: "REJECTED" },
		});

		await tx.auditLog.create({
			data: {
				userId: user.userId,
				organizationId: user.organizationId,
				action: AuditAction.REJECT_WORK,
				entity: "WorkSubmission",
				entityId: id,
				metadata: {
					taskId: submission.taskId,
					employeeId: submission.employeeId,
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
			task: true,
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
