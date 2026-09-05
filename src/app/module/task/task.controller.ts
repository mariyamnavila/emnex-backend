import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TaskService } from "./task.service";

const getMyTasks = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await TaskService.getMyTasks(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My tasks retrieved successfully",
		data: result,
	});
});

const createTask = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await TaskService.createTask(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Task created successfully",
		data: result,
	});
});

const getAllTasks = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const { page, limit, search, status, priority, projectId, employeeId } =
		req.query;

	const result = await TaskService.getAllTasks(user, {
		page: page ? Number(page) : undefined,
		limit: limit ? Number(limit) : undefined,
		search: search as string,
		status: status as string,
		priority: priority as string,
		projectId: projectId as string,
		employeeId: employeeId as string,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Tasks retrieved successfully",
		data: result.tasks,
		meta: result.pagination,
	});
});

const getTaskById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await TaskService.getTaskById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task retrieved successfully",
		data: result,
	});
});

const updateTask = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await TaskService.updateTask(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task updated successfully",
		data: result,
	});
});

const deleteTask = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await TaskService.deleteTask(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const assignTask = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await TaskService.assignTask(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task assigned successfully",
		data: result,
	});
});

const updateTaskStatus = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await TaskService.updateTaskStatus(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task status updated successfully",
		data: result,
	});
});

const getTaskSubmissions = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await TaskService.getTaskSubmissions(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Task submissions retrieved successfully",
		data: result,
	});
});

export const TaskController = {
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
