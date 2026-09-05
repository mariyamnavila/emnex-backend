import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProjectService } from "./project.service";

const createProject = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await ProjectService.createProject(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Project created successfully",
		data: result,
	});
});

const getAllProjects = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const { page, limit, search, status } = req.query;

	const result = await ProjectService.getAllProjects(user, {
		page: page ? Number(page) : undefined,
		limit: limit ? Number(limit) : undefined,
		search: search as string,
		status: status as string,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Projects retrieved successfully",
		data: result.projects,
		meta: result.pagination,
	});
});

const getProjectById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await ProjectService.getProjectById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project retrieved successfully",
		data: result,
	});
});

const updateProject = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await ProjectService.updateProject(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project updated successfully",
		data: result,
	});
});

const deleteProject = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await ProjectService.deleteProject(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const getProjectTasks = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await ProjectService.getProjectTasks(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project tasks retrieved successfully",
		data: result,
	});
});

const getProjectStats = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await ProjectService.getProjectStats(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Project stats retrieved successfully",
		data: result,
	});
});

export const ProjectController = {
	createProject,
	getAllProjects,
	getProjectById,
	updateProject,
	deleteProject,
	getProjectTasks,
	getProjectStats,
};
