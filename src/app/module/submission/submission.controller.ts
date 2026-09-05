import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SubmissionService } from "./submission.service";

const createSubmission = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await SubmissionService.createSubmission(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Submission created successfully",
		data: result,
	});
});

const getAllSubmissions = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const { page, limit, status, taskId, employeeId } = req.query;

	const result = await SubmissionService.getAllSubmissions(user, {
		page: page ? Number(page) : undefined,
		limit: limit ? Number(limit) : undefined,
		status: status as string,
		taskId: taskId as string,
		employeeId: employeeId as string,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submissions retrieved successfully",
		data: result.submissions,
		meta: result.pagination,
	});
});

const getSubmissionById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await SubmissionService.getSubmissionById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submission retrieved successfully",
		data: result,
	});
});

const updateSubmission = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await SubmissionService.updateSubmission(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submission updated successfully",
		data: result,
	});
});

const approveSubmission = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await SubmissionService.approveSubmission(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submission approved successfully",
		data: result,
	});
});

const rejectSubmission = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await SubmissionService.rejectSubmission(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Submission rejected successfully",
		data: result,
	});
});

const getMySubmissions = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await SubmissionService.getMySubmissions(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My submissions retrieved successfully",
		data: result,
	});
});

export const SubmissionController = {
	createSubmission,
	getAllSubmissions,
	getSubmissionById,
	updateSubmission,
	approveSubmission,
	rejectSubmission,
	getMySubmissions,
};
