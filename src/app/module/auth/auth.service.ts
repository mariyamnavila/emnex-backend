import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import type { SignOptions } from "jsonwebtoken";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
	ILoginPayload,
	IRegisterPayload,
	IRequestUser,
} from "./auth.interface";

const register = async (payload: IRegisterPayload) => {
	const { organizationName, organizationSlug, name, email, password } = payload;

	// 1. Check existing user and organization
	const [existingUser, existingOrg] = await Promise.all([
		prisma.user.findUnique({ where: { email } }),
		prisma.organization.findUnique({
			where: { slug: organizationSlug },
		}),
	]);

	if (existingUser) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	if (existingOrg) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Organization slug is already taken",
		);
	}

	// 2. Get system roles + permissions
	const systemRoles = await prisma.role.findMany({
		where: {
			isSystem: true,
			organizationId: null,
		},
		include: {
			permissions: {
				select: {
					permissionId: true,
				},
			},
		},
	});

	if (!systemRoles.length) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"System roles not found",
		);
	}

	// 3. Hash password
	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	// 4. Create organization, roles, permissions and admin
	const result = await prisma.$transaction(async (tx) => {
		const organization = await tx.organization.create({
			data: {
				name: organizationName,
				slug: organizationSlug,
			},
		});

		// Create organization roles
		const roles = await Promise.all(
			systemRoles.map((role) =>
				tx.role.create({
					data: {
						name: role.name,
						description: role.description,
						organizationId: organization.id,
					},
				}),
			),
		);

		const roleIdMap = new Map(roles.map((role) => [role.name, role.id]));

		// Copy permissions
		const rolePermissionData = systemRoles.flatMap((systemRole) => {
			const newRoleId = roleIdMap.get(systemRole.name);

			if (!newRoleId) return [];

			return systemRole.permissions.map((permission) => ({
				roleId: newRoleId,
				permissionId: permission.permissionId,
			}));
		});

		await tx.rolePermission.createMany({
			data: rolePermissionData,
		});

		// Create admin
		const user = await tx.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				organizationId: organization.id,
				roleId: roleIdMap.get("ADMIN")!,
				emailVerified: true,
			},
			omit: {
				password: true,
			},
		});

		return {
			organization,
			user,
		};
	});

	// 5. Generate tokens
	const jwtPayload = {
		userId: result.user.id,
		name: result.user.name,
		email: result.user.email,
		role: "ADMIN",
		organizationId: result.organization.id,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		organization: result.organization,
		user: result.user,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginPayload) => {
	const { email, password } = payload;

	const user = await prisma.user.findUnique({
		where: { email },
		include: { role: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked");
	}

	if (user.isDeleted || user.status === "DELETED") {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted");
	}

	if (!user.password) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Your account is linked with Google. Please login with Google.",
		);
	}

	const isPasswordValid = await bcrypt.compare(password, user.password);

	if (!isPasswordValid) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role.name,
		organizationId: user.organizationId,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role.name,
			organizationId: user.organizationId,
		},
	};
};

const getMe = async (user: IRequestUser) => {
	const userRecord = await prisma.user.findUnique({
		where: { id: user.userId },
		omit: { password: true },
		include: {
			role: true,
			organization: true,
		},
	});

	if (!userRecord) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return userRecord;
};

const refreshToken = async (token: string) => {
	const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

	if (!verified.success || !verified.data) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
	}

	const user = await prisma.user.findUnique({
		where: { id: verified.data.userId },
		include: { role: true },
	});

	if (!user || user.isDeleted || user.status !== "ACTIVE") {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role.name,
		organizationId: user.organizationId,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const newRefreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken: newRefreshToken };
};

const changePassword = async (
	user: IRequestUser,
	currentPassword: string,
	newPassword: string,
) => {
	const userRecord = await prisma.user.findUnique({
		where: { id: user.userId },
	});

	if (!userRecord || !userRecord?.password) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (currentPassword === newPassword) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"New password must be different from current password",
		);
	}

	const isCurrentPasswordValid = await bcrypt.compare(
		currentPassword,
		userRecord.password,
	);

	if (!isCurrentPasswordValid) {
		throw new AppError(httpStatus.BAD_REQUEST, "Current password is incorrect");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: { id: user.userId },
		data: { password: hashedNewPassword },
	});

	return { message: "Password changed successfully" };
};

export const AuthService = {
	register,
	loginUser,
	getMe,
	refreshToken,
	changePassword,
};
