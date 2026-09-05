import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OrganizationService } from "./organization.service";

const getMyOrganization = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await OrganizationService.getMyOrganization(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization retrieved successfully",
		data: result,
	});
});

const getOrganizationById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await OrganizationService.getOrganizationById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization retrieved successfully",
		data: result,
	});
});

const updateOrganization = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await OrganizationService.updateOrganization(
		id,
		req.body,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization updated successfully",
		data: result,
	});
});

const getOrganizationStats = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await OrganizationService.getOrganizationStats(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Organization stats retrieved successfully",
		data: result,
	});
});

export const OrganizationController = {
	getMyOrganization,
	getOrganizationById,
	updateOrganization,
	getOrganizationStats,
};
