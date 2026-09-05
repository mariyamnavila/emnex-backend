import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type z from "zod";
import { catchAsync } from "../utils/catchAsync";
import { sendResponse } from "../utils/sendResponse";

export const validateRequest = (zodSchema: z.ZodObject) => {
	return catchAsync((req: Request, res: Response, next: NextFunction) => {
		const payload = req.body ?? {};

		const result = zodSchema.safeParse(payload);

		if (!result.success) {
			const errorMessage = result.error.issues.map((issue) => ({
				field: issue.path.join("."),
				message: issue.message,
			}));

			sendResponse(res, {
				success: false,
				statusCode: httpStatus.BAD_REQUEST,
				message: errorMessage.map((e) => e.message).join(", "),
				data: errorMessage,
			});
			return;
		}

		req.body = result.data;

		next();
	});
};
