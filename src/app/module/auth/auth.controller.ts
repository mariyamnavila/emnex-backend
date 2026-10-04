import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IAccount } from "../../interfaces";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

// accessToken lives 24 h, refreshToken 7 days; both httpOnly
const setAuthCookies = (
	res: Response,
	tokens: { accessToken: string; refreshToken: string },
) => {
	const options = {
		httpOnly: true,
		secure: config.node_env === "production",
		sameSite: "none" as const,
	};
	res.cookie("accessToken", tokens.accessToken, {
		...options,
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", tokens.refreshToken, {
		...options,
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});
};

const register = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.register(payload);

	setAuthCookies(res, result);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Organization registered successfully",
		data: {
			organization: result.organization,
			user: result.user,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.loginUser(payload);

	setAuthCookies(res, result);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in successfully",
		data: {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			user: result.user,
		},
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const result = AuthService.getMe(req.account as IAccount);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	if (!req.cookies.refreshToken) {
		throw new AppError(httpStatus.BAD_REQUEST, "Refresh token is missing");
	}

	const result = await AuthService.refreshToken(req.cookies.refreshToken);

	setAuthCookies(res, result);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Token refreshed successfully",
		data: {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const { currentPassword, newPassword } = req.body;

	const result = await AuthService.changePassword(
		user,
		req.account as IAccount,
		currentPassword,
		newPassword,
	);
	setAuthCookies(res, result);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const logout = catchAsync(async (req: Request, res: Response) => {
	res.clearCookie("accessToken");
	res.clearCookie("refreshToken");

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged out successfully",
		data: null,
	});
});

const uploadAvatar = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as IRequestUser;
	const file = req.file;

	if (!file) {
		throw new AppError(httpStatus.BAD_REQUEST, "Please upload an image file");
	}

	const result = await AuthService.uploadAvatar(user, file);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Avatar uploaded successfully",
		data: result,
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const { idToken } = req.body;

	const result = await AuthService.googleLogin({ idToken });

	setAuthCookies(res, result);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged in with Google successfully",
		data: {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			user: result.user,
		},
	});
});

export const AuthController = {
	register,
	loginUser,
	getMe,
	refreshToken,
	changePassword,
	logout,
	uploadAvatar,
	googleLogin,
};
