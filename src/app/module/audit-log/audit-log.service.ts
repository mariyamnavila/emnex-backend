import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

interface IAuditLogQueryParams {
	page?: number;
	limit?: number;
	action?: string;
	entity?: string;
	userId?: string;
}

const getAllAuditLogs = async (
	user: IRequestUser,
	query: IAuditLogQueryParams,
) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 20;
	const { action, entity, userId } = query;

	const where: Record<string, unknown> = {
		organizationId: user.organizationId,
	};

	if (action) {
		where.action = action;
	}

	if (entity) {
		where.entity = entity;
	}

	if (userId) {
		where.userId = userId;
	}

	const skip = (page - 1) * limit;

	const [logs, total] = await Promise.all([
		prisma.auditLog.findMany({
			where,
			include: {
				user: {
					omit: { password: true },
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.auditLog.count({ where }),
	]);

	return {
		logs,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getAuditLogById = async (id: string, user: IRequestUser) => {
	const log = await prisma.auditLog.findFirst({
		where: {
			id,
			organizationId: user.organizationId,
		},
		include: {
			user: {
				omit: { password: true },
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});

	if (!log) {
		throw new AppError(httpStatus.NOT_FOUND, "Audit log not found");
	}

	return log;
};

export const AuditLogService = {
	getAllAuditLogs,
	getAuditLogById,
};
