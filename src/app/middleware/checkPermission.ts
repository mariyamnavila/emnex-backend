import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { IRequestUser } from "../interfaces";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const checkUserPermission = async (
	userId: string,
	permissionName: string,
): Promise<boolean> => {
	const userRecord = await prisma.user.findUnique({
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
		},
	});

	if (!userRecord?.role) {
		return false;
	}

	const userPermissions = userRecord.role.permissions.map(
		(rp) => rp.permission.name,
	);

	return userPermissions.includes(permissionName);
};

// Passes when the user has ANY ONE of the permissions (vs. checkPermission = ALL)
export const checkAnyPermission = (...anyOfPermissions: string[]) => {
	return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
		const user = req.user as IRequestUser;

		if (!user || !user.userId) {
			throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated.");
		}

		const hasAny = anyOfPermissions.some((perm) => user.permissions.includes(perm));
		if (!hasAny) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				`You don't have the required permissions: one of ${anyOfPermissions.join(", ")}`,
			);
		}

		next();
	});
};

export const checkPermission = (...requiredPermissions: string[]) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const user = req.user as IRequestUser;

		if (!user || !user.userId) {
			throw new AppError(httpStatus.UNAUTHORIZED, "You are not authenticated.");
		}

		const hasAllPermissions = requiredPermissions.every((perm) =>
			user.permissions.includes(perm),
		);

		if (!hasAllPermissions) {
			const missing = requiredPermissions.filter(
				(perm) => !user.permissions.includes(perm),
			);
			throw new AppError(
				httpStatus.FORBIDDEN,
				`You don't have the required permissions: ${missing.join(", ")}`,
			);
		}

		next();
	});
};
