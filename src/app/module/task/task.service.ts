import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { checkUserPermission } from "../../middleware/checkPermission";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog, toAuditValue } from "../../utils/auditLog";
import { getCallerEmployeeId } from "../../utils/scope";
import {
	validateEmployeeCanAssign,
	validateEmployeeCanViewTasks,
	validateEmployeeCanWork,
} from "../../utils/employeeStatus";
import type {
	ITaskAssignPayload,
	ITaskCreatePayload,
	ITaskQueryParams,
	ITaskStatusUpdatePayload,
	ITaskUpdatePayload,
} from "./task.interface";

// A task is only workable by someone whose role can move its status (task.update)
// and log hours against it (submission.create). Blocking at assignment time stops
// dead tasks given to a role (e.g. HR) that can't act on them.
const TASK_WORK_PERMISSIONS = ["task.update_own", "submission.create"];
const assertAssigneeCanWorkTasks = async (employeeId: string) => {
	const employee = await prisma.employee.findUnique({
		where: { id: employeeId },
		include: {
			user: {
				include: {
					role: { include: { permissions: { include: { permission: true } } } },
				},
			},
		},
	});
	if (!employee) return; // existence is validated by the caller

	const perms = new Set(employee.user.role.permissions.map((rp) => rp.permission.name));
	const missing = TASK_WORK_PERMISSIONS.filter((p) => !perms.has(p));
	if (missing.length > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`${employee.user.name}'s role can't work on tasks — grant it: ${missing.join(", ")}`,
		);
	}
};

const createTask = async (payload: ITaskCreatePayload, user: IRequestUser) => {
	const {
		projectId,
		employeeId,
		title,
		description,
		estimatedHours,
		priority,
		dueDate,
	} = payload;

	// Verify project exists in this organization
	const project = await prisma.project.findFirst({
		where: {
			id: projectId,
			organizationId: user.organizationId,
			deletedAt: null,
		},
	});

	if (!project) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Project not found in this organization",
		);
	}

	// Verify employee exists in this organization
	const employee = await prisma.employee.findFirst({
		where: {
			id: employeeId,
			organizationId: user.organizationId,
		},
	});

	if (!employee) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Employee not found in this organization",
		);
	}

	validateEmployeeCanAssign(employee.status);
	await assertAssigneeCanWorkTasks(employeeId);

	const task = await prisma.task.create({
		data: {
			projectId,
			employeeId,
			title,
			description,
			estimatedHours,
			priority,
			dueDate: dueDate ? new Date(dueDate) : undefined,
		},
		include: {
			project: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	createAuditLog({
		user,
		action: AuditAction.CREATE_TASK,
		entity: "Task",
		entityId: task.id,
		metadata: {
			taskTitle: title,
			projectName: task.project.name,
			assigneeName: task.employee.user.name,
			priority: task.priority,
			dueDate: toAuditValue(task.dueDate),
			estimatedHours: toAuditValue(task.estimatedHours),
		},
	});

	return task;
};

const getAllTasks = async (user: IRequestUser, query: ITaskQueryParams) => {
	const {
		page = 1,
		limit = 10,
		search,
		status,
		priority,
		projectId,
		employeeId,
	} = query;

	const where: Record<string, unknown> = {
		project: { organizationId: user.organizationId },
		deletedAt: null,
	};

	if (search) {
		where.OR = [
			{ title: { contains: search, mode: "insensitive" } },
			{ description: { contains: search, mode: "insensitive" } },
		];
	}

	if (status) {
		where.status = status;
	}

	if (priority) {
		where.priority = priority;
	}

	if (projectId) {
		where.projectId = projectId;
	}

	if (employeeId) {
		where.employeeId = employeeId;
	}

	// Plain employees (no task-management/review permission) only see their own tasks
	if (!user.permissions.includes("task.view")) {
		where.employeeId = (await getCallerEmployeeId(user)) ?? "__none__";
	}

	const skip = (page - 1) * limit;

	const [tasks, total] = await Promise.all([
		prisma.task.findMany({
			where,
			include: {
				project: true,
				employee: {
					include: {
						user: { omit: { password: true } },
					},
				},
				_count: {
					select: { submissions: true },
				},
			},
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.task.count({ where }),
	]);

	return {
		tasks,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getTaskById = async (id: string, user: IRequestUser) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: {
			project: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
			submissions: {
				orderBy: { createdAt: "desc" },
			},
		},
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view tasks in your organization",
		);
	}

	// Plain employees (no task-management/review permission) can only view their own
	if (!user.permissions.includes("task.view")) {
		const employeeId = await getCallerEmployeeId(user);
		if (!employeeId || task.employeeId !== employeeId) {
			throw new AppError(httpStatus.FORBIDDEN, "You can only view your own tasks");
		}
	}

	return task;
};

const updateTask = async (
	id: string,
	payload: ITaskUpdatePayload,
	user: IRequestUser,
) => {
	const { title, description, estimatedHours, priority, dueDate } = payload;

	const task = await prisma.task.findUnique({
		where: { id },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.deletedAt) {
		throw new AppError(httpStatus.BAD_REQUEST, "Cannot modify deleted task");
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update tasks in your organization",
		);
	}

	// `task.update` is shared with employees (for status changes); editing task
	// details is a manager action, so a non-manager may only edit their own task
	if (!user.permissions.includes("task.view")) {
		const employeeId = await getCallerEmployeeId(user);
		if (!employeeId || task.employeeId !== employeeId) {
			throw new AppError(httpStatus.FORBIDDEN, "You can only edit your own tasks");
		}
	}

	const updatedTask = await prisma.task.update({
		where: { id },
		data: {
			title,
			description,
			estimatedHours,
			priority,
			dueDate: dueDate ? new Date(dueDate) : undefined,
		},
		include: {
			project: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	return updatedTask;
};

const deleteTask = async (id: string, user: IRequestUser) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: {
			project: true,
		},
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only delete tasks in your organization",
		);
	}

	const deletableStatuses = ["TODO", "COMPLETED"];
	if (!deletableStatuses.includes(task.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot delete task with ${task.status} status. Only TODO or COMPLETED tasks can be deleted.`,
		);
	}

	// Check if task has any submissions
	const submissionCount = await prisma.workSubmission.count({
		where: { taskId: id },
	});

	if (submissionCount > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete task with existing submissions. Remove submissions first.",
		);
	}

	await prisma.task.update({
		where: { id },
		data: { deletedAt: new Date() },
	});

	createAuditLog({
		user,
		action: AuditAction.DELETE_TASK,
		entity: "Task",
		entityId: id,
		metadata: { taskTitle: task.title, projectName: task.project.name },
	});

	return { message: "Task deleted successfully" };
};

const assignTask = async (
	id: string,
	payload: ITaskAssignPayload,
	user: IRequestUser,
) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: {
			project: true,
			employee: { include: { user: { select: { name: true } } } },
		},
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.deletedAt) {
		throw new AppError(httpStatus.BAD_REQUEST, "Cannot assign deleted task");
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update tasks in your organization",
		);
	}

	// Verify new employee exists in this organization
	const employee = await prisma.employee.findFirst({
		where: {
			id: payload.employeeId,
			organizationId: user.organizationId,
		},
	});

	if (!employee) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Employee not found in this organization",
		);
	}

	validateEmployeeCanAssign(employee.status);
	await assertAssigneeCanWorkTasks(payload.employeeId);

	const updatedTask = await prisma.task.update({
		where: { id },
		data: { employeeId: payload.employeeId },
		include: {
			project: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	createAuditLog({
		user,
		action: AuditAction.ASSIGN_TASK,
		entity: "Task",
		entityId: id,
		metadata: {
			taskTitle: task.title,
			projectName: task.project.name,
			from: task.employee.user.name,
			to: updatedTask.employee.user.name,
		},
	});

	return updatedTask;
};

// Where an assignee may move their own task: start (or restart) it, and submit it
const ASSIGNEE_TARGETS = ["IN_PROGRESS", "SUBMITTED"];

const validTaskTransitions: Record<string, string[]> = {
	TODO: ["IN_PROGRESS"],
	IN_PROGRESS: ["SUBMITTED"],
	SUBMITTED: ["APPROVED", "REJECTED"],
	REJECTED: ["IN_PROGRESS"],
	APPROVED: ["COMPLETED"],
	COMPLETED: [],
};

const updateTaskStatus = async (
	id: string,
	payload: ITaskStatusUpdatePayload,
	user: IRequestUser,
) => {
	const { status } = payload;

	const task = await prisma.task.findUnique({
		where: { id },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.deletedAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot update status of deleted task",
		);
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update tasks in your organization",
		);
	}

	// Validate status transition
	const allowed = validTaskTransitions[task.status];
	if (!allowed || !allowed.includes(status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot transition from ${task.status} to ${status}`,
		);
	}

	// The assignee moves their own work forward; reviewing it is someone else's job
	const self = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});
	
	if (self && self.id === task.employeeId) {
		if (!ASSIGNEE_TARGETS.includes(status)) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You can't approve, reject or complete your own task",
			);
		}
		validateEmployeeCanWork(self.status);
	} else {
		// Changing someone else's task needs the manage-all perm (task.update) plus
		// a reason to act on it (assign or review rights) — task.update_own alone
		// only lets you move your own work.
		const [canManageAll, canAssign, canReview] = await Promise.all([
			checkUserPermission(user.userId, "task.update"),
			checkUserPermission(user.userId, "task.assign"),
			checkUserPermission(user.userId, "submission.approve"),
		]);
		if (!canManageAll || (!canAssign && !canReview)) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"You can only change the status of tasks assigned to you",
			);
		}
	}

	const updatedTask = await prisma.task.update({
		where: { id },
		data: { status },
		include: {
			project: true,
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
	});

	createAuditLog({
		user,
		action: AuditAction.CHANGE_TASK_STATUS,
		entity: "Task",
		entityId: id,
		metadata: {
			taskTitle: task.title,
			projectName: task.project.name,
			from: task.status,
			to: status,
		},
	});

	return updatedTask;
};

const getMyTasks = async (user: IRequestUser) => {
	// Find employee record for this user
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This endpoint is for employees only. You can view all tasks.",
		);
	}

	validateEmployeeCanViewTasks(employee.status);

	const tasks = await prisma.task.findMany({
		where: { employeeId: employee.id, deletedAt: null },
		include: {
			project: true,
			_count: {
				select: { submissions: true },
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return tasks;
};

const getTaskSubmissions = async (id: string, user: IRequestUser) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.deletedAt) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot view submissions for deleted task",
		);
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view submissions for tasks in your organization",
		);
	}

	// Plain employees (no review/management permission) only on their own task
	if (!user.permissions.includes("task.view")) {
		const employeeId = await getCallerEmployeeId(user);
		if (!employeeId || task.employeeId !== employeeId) {
			throw new AppError(httpStatus.FORBIDDEN, "You can only view submissions on your own tasks");
		}
	}

	const submissions = await prisma.workSubmission.findMany({
		where: { taskId: id },
		include: {
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return submissions;
};

export const TaskService = {
	createTask,
	getAllTasks,
	getTaskById,
	updateTask,
	deleteTask,
	assignTask,
	updateTaskStatus,
	getMyTasks,
	getTaskSubmissions,
};
