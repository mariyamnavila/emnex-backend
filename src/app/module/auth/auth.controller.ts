import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

const register = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.register(payload);

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24, // 24 hours
	});

	res.cookie("refreshToken", result.refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
	});

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

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});

	res.cookie("refreshToken", result.refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

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
	const user = req.user as IRequestUser;

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	if (!req.cookies.refreshToken) {
		throw new Error("Refresh token is missing");
	}

	const result = await AuthService.refreshToken(req.cookies.refreshToken);

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});

	res.cookie("refreshToken", result.refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

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
		currentPassword,
		newPassword,
	);

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
		throw new Error("Please upload an image file");
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

	res.cookie("accessToken", result.accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});

	res.cookie("refreshToken", result.refreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

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
