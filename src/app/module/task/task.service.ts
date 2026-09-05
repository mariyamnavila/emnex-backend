import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ITaskAssignPayload,
	ITaskCreatePayload,
	ITaskQueryParams,
	ITaskStatusUpdatePayload,
	ITaskUpdatePayload,
} from "./task.interface";

const createTask = async (payload: ITaskCreatePayload, user: IRequestUser) => {
	// Verify project exists in this organization
	const project = await prisma.project.findFirst({
		where: {
			id: payload.projectId,
			organizationId: user.organizationId,
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

	const task = await prisma.task.create({
		data: {
			projectId: payload.projectId,
			employeeId: payload.employeeId,
			title: payload.title,
			description: payload.description,
			estimatedHours: payload.estimatedHours,
			priority: payload.priority,
			dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
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

	return task;
};

const updateTask = async (
	id: string,
	payload: ITaskUpdatePayload,
	user: IRequestUser,
) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update tasks in your organization",
		);
	}

	const updatedTask = await prisma.task.update({
		where: { id },
		data: {
			...payload,
			dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
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
			_count: {
				select: { submissions: true },
			},
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

	if (task._count.submissions > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete task with submissions. Remove submissions first.",
		);
	}

	await prisma.task.delete({ where: { id } });

	return { message: "Task deleted successfully" };
};

const assignTask = async (
	id: string,
	payload: ITaskAssignPayload,
	user: IRequestUser,
) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
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

	return updatedTask;
};

const updateTaskStatus = async (
	id: string,
	payload: ITaskStatusUpdatePayload,
	user: IRequestUser,
) => {
	const task = await prisma.task.findUnique({
		where: { id },
		include: { project: true },
	});

	if (!task) {
		throw new AppError(httpStatus.NOT_FOUND, "Task not found");
	}

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update tasks in your organization",
		);
	}

	const updatedTask = await prisma.task.update({
		where: { id },
		data: { status: payload.status },
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

const getMyTasks = async (user: IRequestUser) => {
	// Find employee record for this user
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		throw new AppError(httpStatus.NOT_FOUND, "Employee record not found");
	}

	const tasks = await prisma.task.findMany({
		where: { employeeId: employee.id },
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

	if (task.project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view submissions for tasks in your organization",
		);
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
