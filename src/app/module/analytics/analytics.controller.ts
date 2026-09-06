import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsService } from "./analytics.service";

const getDashboard = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AnalyticsService.getDashboard(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Dashboard analytics fetched successfully",
			data: result,
		});
	},
);

const getEmployeeAnalytics = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AnalyticsService.getEmployeeAnalytics(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Employee analytics fetched successfully",
			data: result,
		});
	},
);

const getProjectAnalytics = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AnalyticsService.getProjectAnalytics(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Project analytics fetched successfully",
			data: result,
		});
	},
);

const getPayrollAnalytics = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AnalyticsService.getPayrollAnalytics(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payroll analytics fetched successfully",
			data: result,
		});
	},
);

const getPaymentAnalytics = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AnalyticsService.getPaymentAnalytics(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payment analytics fetched successfully",
			data: result,
		});
	},
);

export const AnalyticsController = {
	getDashboard,
	getEmployeeAnalytics,
	getProjectAnalytics,
	getPayrollAnalytics,
	getPaymentAnalytics,
};
