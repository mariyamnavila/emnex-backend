import bcrypt from "bcryptjs";
import config from "../src/app/config";
import { prisma } from "../src/app/lib/prisma";

const ORG_NAME = "EmNex Demo";
const ORG_SLUG = "emnex-demo";

const ADMIN_EMAIL = "admin@emnex.com";
const ADMIN_PASSWORD = "EmnexAdmin123!";

const MANAGER_EMAIL = "manager@emnex.com";
const MANAGER_PASSWORD = "EmnexManager123!";

const EMPLOYEE_EMAIL = "employee@emnex.com";
const EMPLOYEE_PASSWORD = "EmnexEmployee123!";

const FINANCE_EMAIL = "finance@emnex.com";
const FINANCE_PASSWORD = "EmnexFinance123!";

const hash = (password: string) =>
	bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

async function deleteDemoData(orgId: string) {
	// FK-safe order: children first
	const users = await prisma.user.findMany({
		where: { organizationId: orgId },
		select: { id: true },
	});
	const userIds = users.map((u) => u.id);

	await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
	await prisma.workSubmission.deleteMany({
		where: { employee: { organizationId: orgId } },
	});
	await prisma.task.deleteMany({
		where: { employee: { organizationId: orgId } },
	});
	await prisma.payment.deleteMany({
		where: { employee: { organizationId: orgId } },
	});
	await prisma.payroll.deleteMany({
		where: { employee: { organizationId: orgId } },
	});
	await prisma.employee.deleteMany({ where: { organizationId: orgId } });
	await prisma.project.deleteMany({ where: { organizationId: orgId } });
	await prisma.department.deleteMany({ where: { organizationId: orgId } });
	if (userIds.length > 0) {
		await prisma.user.deleteMany({ where: { id: { in: userIds } } });
	}
	await prisma.rolePermission.deleteMany({
		where: { role: { organizationId: orgId } },
	});
	await prisma.role.deleteMany({ where: { organizationId: orgId } });
	await prisma.organization.delete({ where: { id: orgId } });
}

async function main() {
	// Check if already seeded
	const existingOrg = await prisma.organization.findUnique({
		where: { slug: ORG_SLUG },
	});
	if (existingOrg && !process.argv.includes("--force")) {
		console.log("Demo data already exists. Use --force to re-seed.");
		return;
	}
	if (existingOrg) {
		console.log("--force flag detected, wiping existing demo data...");
		await deleteDemoData(existingOrg.id);
		console.log("Wiped.");
	}

	// If demo emails exist without the demo org, they're leftovers from testing
	const conflictingEmails = [
		ADMIN_EMAIL,
		MANAGER_EMAIL,
		EMPLOYEE_EMAIL,
		FINANCE_EMAIL,
	];
	const conflicts = await prisma.user.findMany({
		where: { email: { in: conflictingEmails } },
		select: { id: true, email: true },
	});
	if (conflicts.length > 0) {
		console.log("Conflicting users found (leftover from testing):");
		conflicts.forEach((c) => {
			console.log("  -", c.email);
		});
		console.log("Cleaning up...");

		const conflictIds = conflicts.map((c) => c.id);
		// Delete in FK-safe order
		await prisma.auditLog.deleteMany({
			where: { userId: { in: conflictIds } },
		});
		const conflictEmployees = await prisma.employee.findMany({
			where: { userId: { in: conflictIds } },
			select: { id: true },
		});
		const empIds = conflictEmployees.map((e) => e.id);
		if (empIds.length > 0) {
			await prisma.workSubmission.deleteMany({
				where: { employeeId: { in: empIds } },
			});
			await prisma.task.deleteMany({ where: { employeeId: { in: empIds } } });
			await prisma.payment.deleteMany({
				where: { employeeId: { in: empIds } },
			});
			await prisma.payroll.deleteMany({
				where: { employeeId: { in: empIds } },
			});
			await prisma.employee.deleteMany({ where: { id: { in: empIds } } });
		}
		await prisma.user.deleteMany({ where: { id: { in: conflictIds } } });
		console.log("Cleaned up.");
	}

	// Get system role templates (global, orgId: null)
	const systemRoles = await prisma.role.findMany({
		where: { isSystem: true, organizationId: null },
		include: { permissions: { select: { permissionId: true } } },
	});
	if (systemRoles.length === 0) {
		throw new Error("System roles not seeded. Run the server first.");
	}

	const [adminPass, managerPass, employeePass, financePass] = await Promise.all(
		[
			hash(ADMIN_PASSWORD),
			hash(MANAGER_PASSWORD),
			hash(EMPLOYEE_PASSWORD),
			hash(FINANCE_PASSWORD),
		],
	);

	const result = await prisma.$transaction(
		async (tx) => {
			// 1. Create organization
			const org = await tx.organization.create({
				data: { name: ORG_NAME, slug: ORG_SLUG },
			});

			// 2. Copy system roles to org
			const roles = await Promise.all(
				systemRoles.map((sr) =>
					tx.role.create({
						data: {
							name: sr.name,
							description: sr.description,
							isSystem: true,
							organizationId: org.id,
						},
					}),
				),
			);
			const roleIdMap = new Map(roles.map((r) => [r.name, r.id]));
			const getRoleId = (name: string) => {
				const id = roleIdMap.get(name);
				if (!id) throw new Error(`Role not found: ${name}`);
				return id;
			};

			// Copy permissions
			const rpData = systemRoles.flatMap((sr) => {
				const newRoleId = roleIdMap.get(sr.name);
				if (!newRoleId) return [];
				return sr.permissions.map((p) => ({
					roleId: newRoleId,
					permissionId: p.permissionId,
				}));
			});
			await tx.rolePermission.createMany({ data: rpData });

			// 3. Create admin user (no employee profile — admin manages, doesn't work)
			const admin = await tx.user.create({
				data: {
					name: "Demo Admin",
					email: ADMIN_EMAIL,
					password: adminPass,
					organizationId: org.id,
					roleId: getRoleId("ADMIN"),
					emailVerified: true,
				},
			});

			// 4. Create manager (User + Employee)
			const managerUser = await tx.user.create({
				data: {
					name: "Demo Manager",
					email: MANAGER_EMAIL,
					password: managerPass,
					organizationId: org.id,
					roleId: getRoleId("HR_MANAGER"),
					emailVerified: true,
				},
			});
			const managerEmployee = await tx.employee.create({
				data: {
					userId: managerUser.id,
					organizationId: org.id,
					employeeCode: "EMP-001",
					jobTitle: "HR Manager",
					salaryType: "MONTHLY",
					salary: 6000,
					joiningDate: new Date("2025-06-01"),
				},
			});

			// 5. Create employee (User + Employee)
			const employeeUser = await tx.user.create({
				data: {
					name: "Demo Employee",
					email: EMPLOYEE_EMAIL,
					password: employeePass,
					organizationId: org.id,
					roleId: getRoleId("EMPLOYEE"),
					emailVerified: true,
				},
			});
			const employee = await tx.employee.create({
				data: {
					userId: employeeUser.id,
					organizationId: org.id,
					employeeCode: "EMP-002",
					jobTitle: "Frontend Developer",
					salaryType: "MONTHLY",
					salary: 4000,
					joiningDate: new Date("2025-07-15"),
				},
			});

			// 5b. Create finance manager (User + Employee)
			const financeUser = await tx.user.create({
				data: {
					name: "Demo Finance",
					email: FINANCE_EMAIL,
					password: financePass,
					organizationId: org.id,
					roleId: getRoleId("FINANCE_MANAGER"),
					emailVerified: true,
				},
			});
			const financeEmployee = await tx.employee.create({
				data: {
					userId: financeUser.id,
					organizationId: org.id,
					employeeCode: "EMP-003",
					jobTitle: "Finance Manager",
					salaryType: "MONTHLY",
					salary: 5500,
					joiningDate: new Date("2025-06-15"),
				},
			});

			// 6. Departments
			const deptEngineering = await tx.department.create({
				data: {
					name: "Engineering",
					description: "Software development team",
					organizationId: org.id,
				},
			});
			await tx.department.create({
				data: {
					name: "Marketing",
					description: "Brand and growth team",
					organizationId: org.id,
				},
			});
			const deptFinance = await tx.department.create({
				data: {
					name: "Finance",
					description: "Accounting and payroll",
					organizationId: org.id,
				},
			});

			// Assign manager + employee to Engineering, finance to Finance
			await tx.employee.update({
				where: { id: managerEmployee.id },
				data: { departmentId: deptEngineering.id },
			});
			await tx.employee.update({
				where: { id: employee.id },
				data: { departmentId: deptEngineering.id },
			});
			await tx.employee.update({
				where: { id: financeEmployee.id },
				data: { departmentId: deptFinance.id },
			});

			// 7. Projects
			const project1 = await tx.project.create({
				data: {
					name: "Website Redesign",
					description: "Complete overhaul of the corporate website",
					startDate: new Date("2026-01-01"),
					endDate: new Date("2026-06-30"),
					budget: 50000,
					status: "ACTIVE",
					organizationId: org.id,
				},
			});
			const project2 = await tx.project.create({
				data: {
					name: "Mobile App Launch",
					description: "iOS and Android app development",
					startDate: new Date("2026-02-01"),
					endDate: new Date("2026-09-30"),
					budget: 80000,
					status: "PLANNED",
					organizationId: org.id,
				},
			});
			await tx.project.create({
				data: {
					name: "Q4 Marketing Campaign",
					description: "End-of-year promotional campaign",
					startDate: new Date("2025-10-01"),
					endDate: new Date("2025-12-31"),
					budget: 15000,
					status: "COMPLETED",
					organizationId: org.id,
				},
			});

			// 8. Tasks (assigned to employee and manager)
			const task1 = await tx.task.create({
				data: {
					projectId: project1.id,
					employeeId: employee.id,
					title: "Design homepage mockup",
					description:
						"Create wireframes and high-fidelity mockups for the new homepage",
					estimatedHours: 16,
					priority: "HIGH",
					status: "COMPLETED",
					dueDate: new Date("2026-02-01"),
				},
			});
			const task2 = await tx.task.create({
				data: {
					projectId: project1.id,
					employeeId: employee.id,
					title: "Implement responsive navigation",
					description: "Build the header and mobile menu component",
					estimatedHours: 8,
					priority: "MEDIUM",
					status: "IN_PROGRESS",
					dueDate: new Date("2026-03-01"),
				},
			});
			await tx.task.create({
				data: {
					projectId: project1.id,
					employeeId: employee.id,
					title: "Set up CI/CD pipeline",
					description:
						"Configure GitHub Actions for automated testing and deployment",
					estimatedHours: 6,
					priority: "URGENT",
					status: "TODO",
					dueDate: new Date("2026-03-15"),
				},
			});
			await tx.task.create({
				data: {
					projectId: project2.id,
					employeeId: managerEmployee.id,
					title: "Market research for mobile app",
					description: "Analyze competitor apps and target audience",
					estimatedHours: 20,
					priority: "MEDIUM",
					status: "TODO",
					dueDate: new Date("2026-03-01"),
				},
			});
			await tx.task.create({
				data: {
					projectId: project1.id,
					employeeId: employee.id,
					title: "Write API documentation",
					description: "Document all REST endpoints with examples",
					estimatedHours: 10,
					priority: "LOW",
					status: "SUBMITTED",
					dueDate: new Date("2026-02-28"),
				},
			});

			// 9. Submissions (mix of approved, pending, rejected)
			await tx.workSubmission.create({
				data: {
					taskId: task1.id,
					employeeId: employee.id,
					description:
						"Completed homepage mockup with desktop and mobile variants in Figma",
					hoursWorked: 14,
					workDate: new Date("2026-01-20"),
					status: "APPROVED",
					reviewedBy: managerUser.id,
					reviewedAt: new Date("2026-01-21"),
					reviewNote: "Great work, clean design",
				},
			});
			await tx.workSubmission.create({
				data: {
					taskId: task2.id,
					employeeId: employee.id,
					description:
						"Implemented responsive nav with hamburger menu for mobile breakpoints",
					hoursWorked: 6,
					workDate: new Date("2026-02-10"),
					status: "PENDING",
				},
			});
			await tx.workSubmission.create({
				data: {
					taskId: task1.id,
					employeeId: employee.id,
					description: "Initial wireframe drafts for homepage sections",
					hoursWorked: 5,
					workDate: new Date("2026-01-15"),
					status: "REJECTED",
					reviewedBy: managerUser.id,
					reviewedAt: new Date("2026-01-16"),
					reviewNote: "Needs more detail in the hero section, please revise",
				},
			});

			// 10. Payroll (one generated for employee)
			const payroll1 = await tx.payroll.create({
				data: {
					organizationId: org.id,
					employeeId: employee.id,
					periodStart: new Date("2026-01-01"),
					periodEnd: new Date("2026-01-31"),
					grossAmount: 4000,
					deductions: 400,
					netAmount: 3600,
					status: "APPROVED",
				},
			});
			await tx.payroll.create({
				data: {
					organizationId: org.id,
					employeeId: employee.id,
					periodStart: new Date("2026-02-01"),
					periodEnd: new Date("2026-02-28"),
					grossAmount: 4000,
					deductions: 400,
					netAmount: 3600,
					status: "GENERATED",
				},
			});
			await tx.payroll.create({
				data: {
					organizationId: org.id,
					employeeId: managerEmployee.id,
					periodStart: new Date("2026-01-01"),
					periodEnd: new Date("2026-01-31"),
					grossAmount: 6000,
					deductions: 600,
					netAmount: 5400,
					status: "PAID",
				},
			});

			// 11. Payment for the paid payroll
			await tx.payment.create({
				data: {
					organizationId: org.id,
					payrollId: payroll1.id,
					employeeId: employee.id,
					amount: 3600,
					currency: "USD",
					gateway: "STRIPE",
					status: "COMPLETED",
					transactionId: "demo_txn_001",
				},
			});

			// 12. Audit logs
			await tx.auditLog.createMany({
				data: [
					{
						userId: admin.id,
						organizationId: org.id,
						action: "CREATE_EMPLOYEE",
						entity: "Employee",
						entityId: employee.id,
						metadata: { email: EMPLOYEE_EMAIL, jobTitle: "Frontend Developer" },
					},
					{
						userId: managerUser.id,
						organizationId: org.id,
						action: "APPROVE_WORK",
						entity: "WorkSubmission",
						metadata: { task: "Design homepage mockup" },
					},
					{
						userId: admin.id,
						organizationId: org.id,
						action: "GENERATE_PAYROLL",
						entity: "Payroll",
						entityId: payroll1.id,
						metadata: { period: "Jan 2026", netAmount: 3600 },
					},
				],
			});

			return { org, admin, managerUser, employeeUser, financeUser };
		},
		{ timeout: 30_000 },
	);

	console.log("Demo data seeded successfully!");
	console.log("─".repeat(50));
	console.log("Organization:", result.org.name, `(${result.org.slug})`);
	console.log("─".repeat(50));
	console.log("Admin:    ", ADMIN_EMAIL, "/", ADMIN_PASSWORD);
	console.log("HR Mgr:   ", MANAGER_EMAIL, "/", MANAGER_PASSWORD);
	console.log("Finance:  ", FINANCE_EMAIL, "/", FINANCE_PASSWORD);
	console.log("Employee: ", EMPLOYEE_EMAIL, "/", EMPLOYEE_PASSWORD);
	console.log("─".repeat(50));
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error("Error seeding demo data:", e);
		await prisma.$disconnect();
		process.exit(1);
	});
