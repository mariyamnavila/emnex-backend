import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog } from "../../utils/auditLog";
import type {
	IProjectCreatePayload,
	IProjectQueryParams,
	IProjectUpdatePayload,
} from "./project.interface";

const createProject = async (
	payload: IProjectCreatePayload,
	user: IRequestUser,
) => {
	const { name, description, startDate, endDate, budget } = payload;

	const project = await prisma.project.create({
		data: {
			name,
			description,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			budget,
			organizationId: user.organizationId,
		},
	});

	createAuditLog({
		user,
		action: AuditAction.CREATE_PROJECT,
		entity: "Project",
		entityId: project.id,
		metadata: { name },
	});

	return project;
};

const getAllProjects = async (
	user: IRequestUser,
	query: IProjectQueryParams,
) => {
	const { page = 1, limit = 10, search, status } = query;

	const where: Record<string, unknown> = {
		organizationId: user.organizationId,
	};

	if (search) {
		where.OR = [
			{ name: { contains: search, mode: "insensitive" } },
			{ description: { contains: search, mode: "insensitive" } },
		];
	}

	if (status) {
		where.status = status;
	}

	const skip = (page - 1) * limit;

	const [projects, total] = await Promise.all([
		prisma.project.findMany({
			where,
			include: {
				_count: {
					select: { tasks: true },
				},
			},
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.project.count({ where }),
	]);

	return {
		projects,
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getProjectById = async (id: string, user: IRequestUser) => {
	const project = await prisma.project.findUnique({
		where: { id },
		include: {
			tasks: {
				include: {
					employee: {
						include: {
							user: { omit: { password: true } },
						},
					},
				},
				orderBy: { createdAt: "desc" },
			},
			_count: {
				select: { tasks: true },
			},
		},
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	if (project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view projects in your organization",
		);
	}

	return project;
};

const updateProject = async (
	id: string,
	payload: IProjectUpdatePayload,
	user: IRequestUser,
) => {
	const { name, description, startDate, endDate, budget, status } = payload;

	const project = await prisma.project.findUnique({
		where: { id },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	if (project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update projects in your organization",
		);
	}

	const updatedProject = await prisma.project.update({
		where: { id },
		data: {
			name,
			description,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			budget,
			status,
		},
	});

	createAuditLog({
		user,
		action: AuditAction.UPDATE_PROJECT,
		entity: "Project",
		entityId: id,
		metadata: { name, description, budget, status },
	});

	return updatedProject;
};

const deleteProject = async (id: string, user: IRequestUser) => {
	const project = await prisma.project.findUnique({
		where: { id },
		include: {
			_count: {
				select: { tasks: true },
			},
		},
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	if (project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only delete projects in your organization",
		);
	}

	if (project._count.tasks > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete project with assigned tasks. Remove tasks first.",
		);
	}

	await prisma.project.delete({ where: { id } });

	createAuditLog({
		user,
		action: AuditAction.DELETE_PROJECT,
		entity: "Project",
		entityId: id,
	});

	return { message: "Project deleted successfully" };
};

const getProjectTasks = async (id: string, user: IRequestUser) => {
	const project = await prisma.project.findUnique({
		where: { id },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	if (project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view tasks for projects in your organization",
		);
	}

	const tasks = await prisma.task.findMany({
		where: { projectId: id },
		include: {
			employee: {
				include: {
					user: { omit: { password: true } },
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	return tasks;
};

const getProjectStats = async (id: string, user: IRequestUser) => {
	const project = await prisma.project.findUnique({
		where: { id },
	});

	if (!project) {
		throw new AppError(httpStatus.NOT_FOUND, "Project not found");
	}

	if (project.organizationId !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view stats for projects in your organization",
		);
	}

	const [
		totalTasks,
		todoTasks,
		inProgressTasks,
		completedTasks,
		totalSubmissions,
		approvedSubmissions,
	] = await Promise.all([
		prisma.task.count({ where: { projectId: id } }),
		prisma.task.count({ where: { projectId: id, status: "TODO" } }),
		prisma.task.count({ where: { projectId: id, status: "IN_PROGRESS" } }),
		prisma.task.count({ where: { projectId: id, status: "COMPLETED" } }),
		prisma.workSubmission.count({
			where: { task: { projectId: id } },
		}),
		prisma.workSubmission.count({
			where: { task: { projectId: id }, status: "APPROVED" },
		}),
	]);

	return {
		totalTasks,
		todoTasks,
		inProgressTasks,
		completedTasks,
		totalSubmissions,
		approvedSubmissions,
	};
};

export const ProjectService = {
	createProject,
	getAllProjects,
	getProjectById,
	updateProject,
	deleteProject,
	getProjectTasks,
	getProjectStats,
};
