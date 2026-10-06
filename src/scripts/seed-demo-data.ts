/**
 * Populates the "emnex-demo" organization with realistic data so the demo
 * accounts (admin/manager/finance/employee @emnex.com) look rich on first login.
 * Idempotent: guarded by a marker user, so re-running is a no-op.
 *   npx tsx src/scripts/seed-demo-data.ts
 */
import bcrypt from "bcryptjs";
import config from "../app/config";
import { prisma } from "../app/lib/prisma";

const DEMO_SLUG = "emnex-demo";
const DEMO_PASSWORD = "Demo1234!";
const MARKER_EMAIL = "alex.chen@emnex.demo";

const NEW_EMPLOYEES = [
	{ name: "Alex Chen", email: "alex.chen@emnex.demo", jobTitle: "Senior Engineer", salaryType: "MONTHLY", salary: 9200, dept: "Engineering" },
	{ name: "Priya Nair", email: "priya.nair@emnex.demo", jobTitle: "Backend Engineer", salaryType: "MONTHLY", salary: 7600, dept: "Engineering" },
	{ name: "Marcus Vance", email: "marcus.vance@emnex.demo", jobTitle: "DevOps Engineer", salaryType: "HOURLY", hourlyRate: 56, dept: "Engineering" },
	{ name: "Sophie Dubois", email: "sophie.dubois@emnex.demo", jobTitle: "Product Designer", salaryType: "MONTHLY", salary: 7000, dept: "Design" },
	{ name: "David Park", email: "david.park@emnex.demo", jobTitle: "UX Designer", salaryType: "HOURLY", hourlyRate: 48, dept: "Design" },
	{ name: "Lena Fischer", email: "lena.fischer@emnex.demo", jobTitle: "Sales Lead", salaryType: "MONTHLY", salary: 8100, dept: "Sales" },
	{ name: "Tom Baker", email: "tom.baker@emnex.demo", jobTitle: "Account Executive", salaryType: "HOURLY", hourlyRate: 42, dept: "Sales" },
	{ name: "Nina Patel", email: "nina.patel@emnex.demo", jobTitle: "Support Specialist", salaryType: "HOURLY", hourlyRate: 36, dept: "Support" },
] as const;

const TASK_TITLES = [
	"Set up CI/CD pipeline", "Design the onboarding flow", "Fix checkout bug", "Write API docs",
	"Build the dashboard widgets", "Migrate the database", "Create marketing landing page",
	"Implement search", "Optimize image loading", "Add role-based access", "Refactor the auth module",
	"QA the payment flow", "Draft the Q4 sales deck", "Set up monitoring", "Improve mobile layout",
	"Review customer feedback", "Prepare release notes", "Audit accessibility",
];
const TASK_STATUS = ["TODO", "IN_PROGRESS", "SUBMITTED", "APPROVED", "COMPLETED", "IN_PROGRESS", "TODO"];
const PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

const run = async () => {
	const org = await prisma.organization.findFirst({ where: { slug: DEMO_SLUG } });
	if (!org) return console.log(`No "${DEMO_SLUG}" org — nothing to seed.`);

	if (await prisma.user.findFirst({ where: { email: MARKER_EMAIL } })) {
		return console.log("Demo data already seeded — nothing to do.");
	}

	const empRole = await prisma.role.findFirst({
		where: { name: "EMPLOYEE", isSystem: true, organizationId: org.id },
	});
	if (!empRole) return console.log("No EMPLOYEE role for the demo org.");

	const reviewer = await prisma.user.findFirst({ where: { email: "manager@emnex.com" } });
	const password = await bcrypt.hash(DEMO_PASSWORD, Number(config.bcrypt_salt_rounds));

	// 1) Departments
	const deptIds: Record<string, string> = {};
	for (const name of ["Engineering", "Design", "Sales", "Support", "Operations"]) {
		const existing = await prisma.department.findFirst({ where: { organizationId: org.id, name, deletedAt: null } });
		const dept = existing ?? (await prisma.department.create({ data: { organizationId: org.id, name, description: `${name} team` } }));
		deptIds[name] = dept.id;
	}

	// 2) Employees (keep the existing 4, add new ones)
	const last = await prisma.employee.findFirst({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } });
	let seq = last ? Number.parseInt(last.employeeCode.split("-")[1] ?? "0", 10) : 0;
	const nextCode = () => `EMP-${String(++seq).padStart(3, "0")}`;

	for (const [i, p] of NEW_EMPLOYEES.entries()) {
		const user = await prisma.user.create({
			data: {
				name: p.name, email: p.email, password, organizationId: org.id,
				roleId: empRole.id, status: "ACTIVE", emailVerified: true, mustChangePassword: false,
			},
		});
		await prisma.employee.create({
			data: {
				organizationId: org.id, userId: user.id, departmentId: deptIds[p.dept], employeeCode: nextCode(),
				jobTitle: p.jobTitle, salaryType: p.salaryType,
				salary: "salary" in p ? p.salary : null, hourlyRate: "hourlyRate" in p ? p.hourlyRate : null,
				joiningDate: d(2025, ((i % 9) + 1), 10), status: "ACTIVE",
			},
		});
	}

	// Full active roster (existing + new)
	const employees = await prisma.employee.findMany({
		where: { organizationId: org.id, status: "ACTIVE" },
		include: { user: { select: { email: true } } },
	});
	const projects = await prisma.project.findMany({ where: { organizationId: org.id, deletedAt: null } });

	// 3) Tasks — spread across projects + employees + statuses
	const tasks: { id: string; employeeId: string; salaryType: string }[] = [];
	for (const [i, title] of TASK_TITLES.entries()) {
		const project = projects[i % projects.length];
		const employee = employees[i % employees.length];
		const task = await prisma.task.create({
			data: {
				projectId: project.id, employeeId: employee.id, title,
				description: `${title} for ${project.name}.`,
				priority: PRIORITY[i % PRIORITY.length] as never,
				status: TASK_STATUS[i % TASK_STATUS.length] as never,
				estimatedHours: 4 + (i % 5) * 2,
				dueDate: d(2026, 10, 10 + (i % 18)),
			},
		});
		tasks.push({ id: task.id, employeeId: employee.id, salaryType: employee.salaryType });
	}

	// 4) Work hours — September (APPROVED, feeds payroll) + a few PENDING in October (review queue)
	const empById = new Map(employees.map((e) => [e.id, e]));
	let pending = 0;
	for (const [i, task] of tasks.entries()) {
		const emp = empById.get(task.employeeId);
		if (!emp) continue;
		// 2 approved September logs per task
		for (let k = 0; k < 2; k++) {
			await prisma.workSubmission.create({
				data: {
					taskId: task.id, employeeId: task.employeeId,
					description: "Worked on the task and pushed progress.",
					hoursWorked: 5 + ((i + k) % 4),
					workDate: d(2026, 9, 3 + ((i * 2 + k) % 24)),
					status: "APPROVED", reviewedBy: reviewer?.id ?? null, reviewedAt: d(2026, 9, 28),
				},
			});
		}
		// a few October PENDING logs to fill the review queue
		if (pending < 6 && i % 3 === 0) {
			await prisma.workSubmission.create({
				data: {
					taskId: task.id, employeeId: task.employeeId,
					description: "Today's progress — ready for review.",
					hoursWorked: 6, workDate: d(2026, 10, 2 + pending), status: "PENDING",
				},
			});
			pending++;
		}
	}

	// 5) Payroll for September + payments for the paid ones
	const PAYROLL_STATUS = ["PAID", "PAID", "APPROVED", "GENERATED", "PAID"];
	for (const [i, emp] of employees.entries()) {
		let gross = 0;
		if (emp.salaryType === "MONTHLY") {
			gross = Number(emp.salary ?? 0);
		} else {
			const approved = await prisma.workSubmission.aggregate({
				_sum: { hoursWorked: true },
				where: { employeeId: emp.id, status: "APPROVED", workDate: { gte: d(2026, 9, 1), lte: d(2026, 9, 30) } },
			});
			gross = Number(approved._sum.hoursWorked ?? 0) * Number(emp.hourlyRate ?? 0);
		}
		if (gross <= 0) continue;
		const deductions = Math.round(gross * 0.08 * 100) / 100;
		const net = Math.round((gross - deductions) * 100) / 100;
		const status = PAYROLL_STATUS[i % PAYROLL_STATUS.length];
		const payroll = await prisma.payroll.create({
			data: {
				organizationId: org.id, employeeId: emp.id,
				periodStart: d(2026, 9, 1), periodEnd: d(2026, 9, 30),
				grossAmount: gross, deductions, netAmount: net, status: status as never,
			},
		});
		if (status === "PAID") {
			await prisma.payment.create({
				data: {
					organizationId: org.id, payrollId: payroll.id, employeeId: emp.id,
					amount: net, currency: "usd", gateway: "STRIPE", status: "COMPLETED",
					transactionId: `demo_txn_${payroll.id.slice(0, 8)}`,
				},
			});
		}
	}

	console.log(
		`Seeded demo data: +${NEW_EMPLOYEES.length} employees, ${tasks.length} tasks, work hours, September payroll + payments.`,
	);
};

run()
	.catch((error) => {
		console.error("Demo seed failed:", error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
