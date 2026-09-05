import { prisma } from "../lib/prisma";

const defaultPermissions = [
	// Employee
	"employee.view",
	"employee.create",
	"employee.update",
	"employee.delete",

	// Department
	"department.view",
	"department.create",
	"department.update",
	"department.delete",

	// Project
	"project.view",
	"project.create",
	"project.update",
	"project.delete",

	// Task
	"task.view",
	"task.create",
	"task.assign",
	"task.update",
	"task.delete",

	// Submission
	"submission.view",
	"submission.create",
	"submission.approve",
	"submission.reject",

	// Payroll
	"payroll.view",
	"payroll.generate",
	"payroll.approve",
	"payroll.reject",

	// Payment
	"payment.view",
	"payment.create",
	"payment.refund",

	// Role
	"role.view",
	"role.create",
	"role.update",
	"role.delete",

	// Permission
	"permission.view",
	"permission.assign",

	// Audit & Analytics
	"audit.view",
	"analytics.view",
];

const systemRoleTemplates = [
	{
		name: "ADMIN",
		description: "Full organization management",
		permissions: defaultPermissions,
	},
	{
		name: "HR_MANAGER",
		description: "Workforce management",
		permissions: [
			"employee.view",
			"employee.create",
			"employee.update",
			"department.view",
			"department.create",
			"department.update",
			"project.view",
			"task.view",
			"submission.view",
			"submission.approve",
			"submission.reject",
			"analytics.view",
		],
	},
	{
		name: "FINANCE_MANAGER",
		description: "Financial operations",
		permissions: [
			"employee.view",
			"payroll.view",
			"payroll.generate",
			"payroll.approve",
			"payroll.reject",
			"payment.view",
			"payment.create",
			"payment.refund",
			"analytics.view",
		],
	},
	{
		name: "EMPLOYEE",
		description: "Regular employee",
		permissions: [
			"task.view",
			"submission.view",
			"submission.create",
			"payroll.view",
			"payment.view",
		],
	},
];

export const seedPermissions = async () => {
	for (const permissionName of defaultPermissions) {
		await prisma.permission.upsert({
			where: { name: permissionName },
			update: {},
			create: { name: permissionName },
		});
	}
	console.log("Permissions seeded successfully");
};

export const seedSystemRoles = async () => {
	for (const roleData of systemRoleTemplates) {
		let role = await prisma.role.findFirst({
			where: {
				name: roleData.name,
				isSystem: true,
				organizationId: null,
			},
		});

		if (!role) {
			role = await prisma.role.create({
				data: {
					name: roleData.name,
					description: roleData.description,
					isSystem: true,
				},
			});
		}

		const permissions = await prisma.permission.findMany({
			where: {
				name: { in: roleData.permissions },
			},
		});

		for (const permission of permissions) {
			await prisma.rolePermission.upsert({
				where: {
					roleId_permissionId: {
						roleId: role.id,
						permissionId: permission.id,
					},
				},
				update: {},
				create: {
					roleId: role.id,
					permissionId: permission.id,
				},
			});
		}
	}
	console.log("System roles seeded successfully");
};

export const seed = async () => {
	await seedPermissions();
	await seedSystemRoles();
};
