import httpStatus from "http-status";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IOrganizationUpdatePayload } from "./organization.interface";

const getMyOrganization = async (user: IRequestUser) => {
	const organization = await prisma.organization.findUnique({
		where: { id: user.organizationId },
		include: {
			_count: {
				select: {
					users: true,
					departments: true,
					employees: true,
					projects: true,
				},
			},
		},
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	return organization;
};

const getOrganizationById = async (id: string, user: IRequestUser) => {
	const organization = await prisma.organization.findUnique({
		where: { id },
		include: {
			_count: {
				select: {
					users: true,
					departments: true,
					employees: true,
					projects: true,
				},
			},
		},
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (organization.id !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own organization",
		);
	}

	return organization;
};

const updateOrganization = async (
	id: string,
	payload: IOrganizationUpdatePayload,
	user: IRequestUser,
) => {
	const { name, slug } = payload;

	const organization = await prisma.organization.findUnique({
		where: { id },
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (organization.id !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only update your own organization",
		);
	}

	// Check if slug is already taken by another organization
	if (slug && slug !== organization.slug) {
		const existingSlug = await prisma.organization.findUnique({
			where: { slug },
		});

		if (existingSlug) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Organization slug is already taken",
			);
		}
	}

	const updatedOrganization = await prisma.organization.update({
		where: { id },
		data: { name, slug },
	});

	return updatedOrganization;
};

const getOrganizationStats = async (id: string, user: IRequestUser) => {
	const organization = await prisma.organization.findUnique({
		where: { id },
	});

	if (!organization) {
		throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
	}

	if (organization.id !== user.organizationId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You can only view your own organization stats",
		);
	}

	const [
		totalUsers,
		totalDepartments,
		totalEmployees,
		totalProjects,
		activeProjects,
		completedProjects,
	] = await Promise.all([
		prisma.user.count({ where: { organizationId: id, isDeleted: false } }),
		prisma.department.count({ where: { organizationId: id } }),
		prisma.employee.count({ where: { organizationId: id } }),
		prisma.project.count({ where: { organizationId: id } }),
		prisma.project.count({ where: { organizationId: id, status: "ACTIVE" } }),
		prisma.project.count({
			where: { organizationId: id, status: "COMPLETED" },
		}),
	]);

	return {
		totalUsers,
		totalDepartments,
		totalEmployees,
		totalProjects,
		activeProjects,
		completedProjects,
	};
};

export const OrganizationService = {
	getMyOrganization,
	getOrganizationById,
	updateOrganization,
	getOrganizationStats,
};
