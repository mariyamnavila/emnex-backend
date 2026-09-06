import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { EmployeeService } from "./employee.service";

const createEmployee = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await EmployeeService.createEmployee(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Employee created successfully",
		data: result,
	});
});

const getAllEmployees = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const { page, limit, search, departmentId, status, sortBy, sortOrder } =
		req.query;

	const result = await EmployeeService.getAllEmployees(user, {
		page: page ? Number(page) : undefined,
		limit: limit ? Number(limit) : undefined,
		search: search as string,
		departmentId: departmentId as string,
		status: status as string,
		sortBy: sortBy as string,
		sortOrder: sortOrder as "asc" | "desc",
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Employees retrieved successfully",
		data: result.employees,
		meta: result.pagination,
	});
});

const getEmployeeById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await EmployeeService.getEmployeeById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Employee retrieved successfully",
		data: result,
	});
});

const updateEmployee = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await EmployeeService.updateEmployee(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Employee updated successfully",
		data: result,
	});
});

const deleteEmployee = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await EmployeeService.deleteEmployee(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const getEmployeeStats = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await EmployeeService.getEmployeeStats(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Employee stats retrieved successfully",
		data: result,
	});
});

const resendCredentials = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await EmployeeService.resendCredentials(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

export const EmployeeController = {
	createEmployee,
	getAllEmployees,
	getEmployeeById,
	updateEmployee,
	deleteEmployee,
	getEmployeeStats,
	resendCredentials,
};
