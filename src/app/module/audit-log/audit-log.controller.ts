import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuditLogService } from "./audit-log.service";

const getAllAuditLogs = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AuditLogService.getAllAuditLogs(
			user,
			req.query as Record<string, unknown>,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Audit logs fetched successfully",
			data: result.logs,
			meta: result.meta,
		});
	},
);

const getAuditLogById = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await AuditLogService.getAuditLogById(
			req.params.id as string,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Audit log fetched successfully",
			data: result,
		});
	},
);

export const AuditLogController = {
	getAllAuditLogs,
	getAuditLogById,
};
