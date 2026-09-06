import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

export const auth = () => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const token = req.cookies.accessToken
			? req.cookies.accessToken
			: req.headers.authorization?.startsWith("Bearer ")
				? req.headers.authorization?.split(" ")[1]
				: req.headers.authorization;

		if (!token) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"You are not logged in. Please log in to access this resource.",
			);
		}

		const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

		if (!verifiedToken.success || !verifiedToken.data) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				verifiedToken.error || "Invalid token",
			);
		}

		const { userId } = verifiedToken.data;

		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: {
				role: {
					include: {
						permissions: {
							include: {
								permission: true,
							},
						},
					},
				},
				employee: true,
			},
		});

		if (!user) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"User not found. Please log in again.",
			);
		}

		if (user.status === "BLOCKED") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been blocked. Please contact support.",
			);
		}

		if (user.isDeleted || user.status === "DELETED") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been deleted.",
			);
		}

		// Check if employee is terminated
		if (user.employee?.status === "TERMINATED") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been terminated. Please contact support.",
			);
		}

		// Check if assigned role has been soft deleted
		if (user.role?.deletedAt) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your assigned role has been deleted. Please contact support.",
			);
		}

		const permissions =
			user.role?.permissions?.map((rp) => rp.permission.name) ?? [];

		req.user = {
			email: user.email,
			name: user.name,
			userId: user.id,
			role: user.role.name,
			organizationId: user.organizationId,
			permissions,
		};

		next();
	});
};
