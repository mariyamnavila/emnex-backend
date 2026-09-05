import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DepartmentService } from "./department.service";

const createDepartment = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await DepartmentService.createDepartment(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Department created successfully",
		data: result,
	});
});

const getAllDepartments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await DepartmentService.getAllDepartments(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Departments retrieved successfully",
		data: result,
	});
});

const getDepartmentById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await DepartmentService.getDepartmentById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department retrieved successfully",
		data: result,
	});
});

const updateDepartment = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await DepartmentService.updateDepartment(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Department updated successfully",
		data: result,
	});
});

const deleteDepartment = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await DepartmentService.deleteDepartment(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const getDepartmentEmployees = catchAsync(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;
		const user = req.user as IRequestUser;

		const result = await DepartmentService.getDepartmentEmployees(id, user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Department employees retrieved successfully",
			data: result,
		});
	},
);

export const DepartmentController = {
	createDepartment,
	getAllDepartments,
	getDepartmentById,
	updateDepartment,
	deleteDepartment,
	getDepartmentEmployees,
};
