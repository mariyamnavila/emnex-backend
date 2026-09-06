import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const createCheckoutSession = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await PaymentService.createCheckoutSession(req.body, user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Stripe checkout session created successfully",
			data: result,
		});
	},
);

const handleWebhook = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const signature = req.headers["stripe-signature"];
		const rawBody = req.body;

		if (!signature) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Missing stripe-signature header.",
			);
		}

		const result = await PaymentService.handleWebhook(
			rawBody,
			signature as string,
		);

		res.status(httpStatus.OK).json(result);
	},
);

const getAllPayments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await PaymentService.getAllPayments(
			user,
			req.query as Record<string, unknown>,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payments fetched successfully",
			data: result.payments,
			meta: result.meta,
		});
	},
);

const getPaymentById = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await PaymentService.getPaymentById(
			req.params.id as string,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payment fetched successfully",
			data: result,
		});
	},
);

const getMyPayments = catchAsync(
	async (req: Request, res: Response, _next: NextFunction) => {
		const user = req.user as IRequestUser;
		const result = await PaymentService.getMyPayments(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "My payments fetched successfully",
			data: result,
		});
	},
);

export const PaymentController = {
	createCheckoutSession,
	handleWebhook,
	getAllPayments,
	getPaymentById,
	getMyPayments,
};
