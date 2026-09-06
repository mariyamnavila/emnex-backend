import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../interfaces";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const checkPermission = (...requiredPermissions: string[]) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const user = req.user as IRequestUser;

		if (!user || !user.userId) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"You are not authenticated.",
			);
		}

		// Get user with role
		const userRecord = await prisma.user.findUnique({
			where: { id: user.userId },
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
			},
		});

		if (!userRecord) {
			throw new AppError(httpStatus.UNAUTHORIZED, "User not found.");
		}

		if (!userRecord.role) {
			throw new AppError(httpStatus.FORBIDDEN, "No role assigned.");
		}

		// Get user's permission names
		const userPermissions = userRecord.role.permissions.map(
			(rp) => rp.permission.name,
		);

		// Check if user has all required permissions
		const hasAllPermissions = requiredPermissions.every((perm) =>
			userPermissions.includes(perm),
		);

		if (!hasAllPermissions) {
			const missing = requiredPermissions.filter(
				(perm) => !userPermissions.includes(perm),
			);
			throw new AppError(
				httpStatus.FORBIDDEN,
				`You don't have the required permissions: ${missing.join(", ")}`,
			);
		}

		next();
	});
};
