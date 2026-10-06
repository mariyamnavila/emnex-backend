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

	// Task  (_own = your own tasks; plain = all tasks / management)
	"task.view",
	"task.view_own",
	"task.create",
	"task.assign",
	"task.update",
	"task.update_own",
	"task.delete",

	// Submission / work hours  (_own = your own; plain = everyone's)
	"submission.view",
	"submission.view_own",
	"submission.create",
	"submission.update",
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

// Every working user manages their OWN tasks, work hours and pay with these.
// Management roles add the "all" permissions on top.
const selfServicePermissions = [
	"task.view_own",
	"task.update_own",
	"submission.view_own",
	"submission.create",
	"submission.update",
	"payroll.view_own",
	"payment.view_own",
];

export const systemRoleTemplates = [
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
			...selfServicePermissions,
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
			...selfServicePermissions,
		],
	},
	{
		name: "EMPLOYEE",
		description: "Regular employee",
		permissions: selfServicePermissions,
	},
];

export const seed = async () => {
	try {
		// Always ensure all permissions exist (idempotent, skips duplicates)
		await prisma.permission.createMany({
			data: defaultPermissions.map((name) => ({ name })),
			skipDuplicates: true,
		});

		// Get all permissions for mapping
		const allPermissions = await prisma.permission.findMany();
		const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

		// Check if system roles already exist
		const existingRoles = await prisma.role.count({
			where: { isSystem: true, organizationId: null },
		});

		if (existingRoles === 0) {
			// First run: create system roles with permissions
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
					skipDuplicates: true,
				});
			}
			console.log("System roles seeded");
		} else {
			// Existing DB: backfill any missing role-permission links
			for (const roleData of systemRoleTemplates) {
				const role = await prisma.role.findFirst({
					where: { name: roleData.name, isSystem: true, organizationId: null },
				});
				if (!role) continue;

				const rolePermissions = roleData.permissions
					.filter((p) => permissionMap.has(p))
					.map((p) => ({
						roleId: role.id,
						permissionId: permissionMap.get(p)!,
					}));

				await prisma.rolePermission.createMany({
					data: rolePermissions,
					skipDuplicates: true,
				});
			}
			console.log("Permissions ensured, role permissions backfilled");
		}
	} catch (error) {
		console.error("Error seeding:", error);
	}
};
