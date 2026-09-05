import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PayrollService } from "./payroll.service";

const generatePayroll = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.generatePayroll(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Payroll generated successfully",
		data: result,
	});
});

const getAllPayrolls = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.getAllPayrolls(
		user,
		req.query as Record<string, unknown>,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payrolls fetched successfully",
		data: result.payrolls,
		meta: result.pagination,
	});
});

const getPayrollById = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.getPayrollById(
		req.params.id as string,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payroll fetched successfully",
		data: result,
	});
});

const getMyPayrolls = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.getMyPayrolls(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My payrolls fetched successfully",
		data: result,
	});
});

const approvePayroll = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.approvePayroll(
		req.params.id as string,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payroll approved successfully",
		data: result,
	});
});

const rejectPayroll = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.rejectPayroll(
		req.params.id as string,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payroll rejected successfully",
		data: result,
	});
});

const getPayrollSummary = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const result = await PayrollService.getPayrollSummary(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payroll summary fetched successfully",
		data: result,
	});
});

export const PayrollController = {
	generatePayroll,
	getAllPayrolls,
	getPayrollById,
	getMyPayrolls,
	approvePayroll,
	rejectPayroll,
	getPayrollSummary,
};
