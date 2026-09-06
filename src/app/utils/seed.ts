import { prisma } from "../lib/prisma";

const defaultPermissions = [
	// Organization
	"organization.view",
	"organization.update",

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
	"payroll.view_own",
	"payroll.generate",
	"payroll.approve",
	"payroll.reject",

	// Payment
	"payment.view",
	"payment.view_own",
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
			"organization.view",
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
			"organization.view",
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
			"payroll.view_own",
			"payment.view_own",
		],
	},
];

export const seed = async () => {
	try {
		// Check if already seeded
		const existingPermissions = await prisma.permission.count();
		if (existingPermissions > 0) {
			console.log("Database already seeded, skipping...");
			return;
		}

		// Bulk create permissions
		await prisma.permission.createMany({
			data: defaultPermissions.map((name) => ({ name })),
			skipDuplicates: true,
		});
		console.log("Permissions seeded");

		// Get all permissions for mapping
		const allPermissions = await prisma.permission.findMany();
		const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

		// Create system roles with permissions in transaction
		for (const roleData of systemRoleTemplates) {
			const role = await prisma.role.create({
				data: {
					name: roleData.name,
					description: roleData.description,
					isSystem: true,
				},
			});

			const rolePermissions = roleData.permissions
				.filter((p) => permissionMap.has(p))
				.map((p) => ({
					roleId: role.id,
					permissionId: permissionMap.get(p)!,
				}));

			await prisma.rolePermission.createMany({
				data: rolePermissions,
			});
		}
		console.log("System roles seeded");
	} catch (error) {
		console.error("Error seeding:", error);
	}
};
