import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RoleService } from "./role.service";

const createRole = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await RoleService.createRole(req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Role created successfully",
		data: result,
	});
});

const getAllRoles = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;

	const result = await RoleService.getAllRoles(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Roles retrieved successfully",
		data: result,
	});
});

const getRoleById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await RoleService.getRoleById(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Role retrieved successfully",
		data: result,
	});
});

const updateRole = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await RoleService.updateRole(id, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Role updated successfully",
		data: result,
	});
});

const deleteRole = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const user = req.user as IRequestUser;

	const result = await RoleService.deleteRole(id, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const getAllPermissions = catchAsync(async (req: Request, res: Response) => {
	const result = await RoleService.getAllPermissions();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Permissions retrieved successfully",
		data: result,
	});
});

const getRolePermissions = catchAsync(async (req: Request, res: Response) => {
	const roleId = req.params.roleId as string;
	const user = req.user as IRequestUser;

	const result = await RoleService.getRolePermissions(roleId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Role permissions retrieved successfully",
		data: result,
	});
});

const assignPermissions = catchAsync(async (req: Request, res: Response) => {
	const roleId = req.params.roleId as string;
	const user = req.user as IRequestUser;

	const result = await RoleService.assignPermissions(roleId, req.body, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Permissions assigned successfully",
		data: result,
	});
});

const removePermission = catchAsync(async (req: Request, res: Response) => {
	const roleId = req.params.roleId as string;
	const permissionId = req.params.permissionId as string;
	const user = req.user as IRequestUser;

	const result = await RoleService.removePermission(roleId, permissionId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

export const RoleController = {
	createRole,
	getAllRoles,
	getRoleById,
	updateRole,
	deleteRole,
	getAllPermissions,
	getRolePermissions,
	assignPermissions,
	removePermission,
};
