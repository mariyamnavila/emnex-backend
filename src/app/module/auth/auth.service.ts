import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import type { SignOptions } from "jsonwebtoken";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog } from "../../utils/auditLog";
import { jwtUtils } from "../../utils/jwt";
import type {
	IGoogleLoginPayload,
	ILoginPayload,
	IRegisterPayload,
	IRequestUser,
} from "./auth.interface";

const register = async (payload: IRegisterPayload) => {
	const { organizationName, organizationSlug, name, email, password } = payload;

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

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

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
						isSystem: true,
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
		createAuditLog({
			user: { userId: user.id, organizationId: user.organizationId },
			action: AuditAction.LOGIN_FAILED,
			entity: "User",
			entityId: user.id,
			metadata: { email },
		});
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

	createAuditLog({
		user: { userId: user.id, organizationId: user.organizationId },
		action: AuditAction.LOGIN,
		entity: "User",
		entityId: user.id,
		metadata: { email },
	});

	return {
		accessToken,
		refreshToken,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role.name,
			organizationId: user.organizationId,
			mustChangePassword: user.mustChangePassword,
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
		data: {
			password: hashedNewPassword,
			mustChangePassword: false,
		},
	});

	createAuditLog({
		user,
		action: AuditAction.PASSWORD_CHANGED,
		entity: "User",
		entityId: user.userId,
	});

	return { message: "Password changed successfully" };
};

const uploadAvatar = async (user: IRequestUser, file: Express.Multer.File) => {
	const userRecord = await prisma.user.findUnique({
		where: { id: user.userId },
	});

	if (!userRecord) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	// Upload to cloudinary
	const result = await new Promise<{ secure_url: string; public_id: string }>(
		(resolve, reject) => {
			const uploadStream = cloudinary.uploader.upload_stream(
				{
					folder: "emnex/avatars",
					public_id: `avatar-${user.userId}`,
					overwrite: true,
				},
				(error, result) => {
					if (error) reject(error);
					else resolve(result as { secure_url: string; public_id: string });
				},
			);
			uploadStream.end(file.buffer);
		},
	);

	// Update user avatar
	await prisma.user.update({
		where: { id: user.userId },
		data: {
			avatar: result.secure_url,
		},
	});

	return {
		avatar: result.secure_url,
	};
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: {
		email?: string;
		name?: string;
		sub?: string;
	} | null = null;

	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		googleIdTokenPayload = ticket.getPayload() ?? null;
	} catch {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid or expired Google ID token",
		);
	}

	if (!googleIdTokenPayload?.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google email not found");
	}

	const email = googleIdTokenPayload.email;
	const googleId = googleIdTokenPayload.sub;

	// Find existing user with this email
	let user = await prisma.user.findUnique({
		where: { email },
		include: { role: true },
	});

	if (user) {
		// User exists — check status
		if (user.status === "BLOCKED") {
			throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked");
		}

		if (user.isDeleted || user.status === "DELETED") {
			throw new AppError(httpStatus.FORBIDDEN, "Your account has been deleted");
		}

		// Link Google account if not already linked
		if (!user.googleId) {
			user = await prisma.user.update({
				where: { id: user.id },
				data: { googleId },
				include: { role: true },
			});
		}
	} else {
		// No user found with this email
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"No account found with this email. Please register through your organization first.",
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

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	createAuditLog({
		user: { userId: user.id, organizationId: user.organizationId },
		action: AuditAction.GOOGLE_LOGIN,
		entity: "User",
		entityId: user.id,
		metadata: { email },
	});

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

export const AuthService = {
	register,
	loginUser,
	getMe,
	refreshToken,
	changePassword,
	uploadAvatar,
	googleLogin,
};
