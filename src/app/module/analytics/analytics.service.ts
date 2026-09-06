import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";

const toNumber = (value: unknown): number => {
	if (typeof value === "object" && value !== null && "toString" in value) {
		return Number(value.toString());
	}
	return Number(value);
};

const getDashboard = async (user: IRequestUser) => {
	const orgId = user.organizationId;
	const role = user.role;

	if (role === "ADMIN") {
		const [
			totalEmployees,
			activeEmployees,
			activeProjects,
			pendingSubmissions,
			pendingPayroll,
			totalPayrollResult,
			completedPayments,
		] = await Promise.all([
			prisma.employee.count({ where: { organizationId: orgId } }),
			prisma.employee.count({
				where: { organizationId: orgId, status: "ACTIVE" },
			}),
			prisma.project.count({
				where: { organizationId: orgId, status: "ACTIVE" },
			}),
			prisma.workSubmission.count({
				where: {
					task: { project: { organizationId: orgId } },
					status: "PENDING",
				},
			}),
			prisma.payroll.count({
				where: {
					organizationId: orgId,
					status: { in: ["DRAFT", "GENERATED"] },
				},
			}),
			prisma.payroll.aggregate({
				where: { organizationId: orgId },
				_sum: { netAmount: true },
			}),
			prisma.payment.count({
				where: { organizationId: orgId, status: "COMPLETED" },
			}),
		]);

		const totalPayroll = toNumber(totalPayrollResult._sum.netAmount);

		return {
			totalEmployees,
			activeEmployees,
			activeProjects,
			pendingSubmissions,
			pendingPayroll,
			totalPayroll,
			completedPayments,
		};
	}

	if (role === "HR_MANAGER") {
		const [
			totalEmployees,
			activeEmployees,
			totalDepartments,
			newEmployeesThisMonth,
			employeeByStatus,
		] = await Promise.all([
			prisma.employee.count({ where: { organizationId: orgId } }),
			prisma.employee.count({
				where: { organizationId: orgId, status: "ACTIVE" },
			}),
			prisma.department.count({ where: { organizationId: orgId } }),
			prisma.employee.count({
				where: {
					organizationId: orgId,
					createdAt: {
						gte: new Date(new Date().setDate(1)),
					},
				},
			}),
			prisma.employee.groupBy({
				by: ["status"],
				where: { organizationId: orgId },
				_count: true,
			}),
		]);

		return {
			totalEmployees,
			activeEmployees,
			totalDepartments,
			newEmployeesThisMonth,
			employeeByStatus,
		};
	}

	if (role === "FINANCE_MANAGER") {
		const [
			pendingPayroll,
			approvedPayroll,
			totalPayrollResult,
			pendingPayments,
			completedPayments,
			failedPayments,
		] = await Promise.all([
			prisma.payroll.count({
				where: {
					organizationId: orgId,
					status: { in: ["DRAFT", "GENERATED"] },
				},
			}),
			prisma.payroll.count({
				where: { organizationId: orgId, status: "APPROVED" },
			}),
			prisma.payroll.aggregate({
				where: { organizationId: orgId },
				_sum: { netAmount: true },
			}),
			prisma.payment.count({
				where: { organizationId: orgId, status: "PENDING" },
			}),
			prisma.payment.count({
				where: { organizationId: orgId, status: "COMPLETED" },
			}),
			prisma.payment.count({
				where: { organizationId: orgId, status: "FAILED" },
			}),
		]);

		const totalPayroll = toNumber(totalPayrollResult._sum.netAmount);

		return {
			pendingPayroll,
			approvedPayroll,
			totalPayroll,
			pendingPayments,
			completedPayments,
			failedPayments,
		};
	}

	// Employee dashboard
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		return { message: "Employee profile not found" };
	}

	const [
		myTasks,
		completedTasks,
		pendingSubmissions,
		currentPayroll,
		lastPayment,
	] = await Promise.all([
		prisma.task.count({
			where: { employeeId: employee.id },
		}),
		prisma.task.count({
			where: { employeeId: employee.id, status: "COMPLETED" },
		}),
		prisma.workSubmission.count({
			where: { employeeId: employee.id, status: "PENDING" },
		}),
		prisma.payroll.findFirst({
			where: {
				employeeId: employee.id,
				status: { in: ["DRAFT", "GENERATED", "APPROVED"] },
			},
			orderBy: { createdAt: "desc" },
			select: { netAmount: true, status: true },
		}),
		prisma.payment.findFirst({
			where: { employeeId: employee.id, status: "COMPLETED" },
			orderBy: { createdAt: "desc" },
			select: { amount: true, createdAt: true },
		}),
	]);

	const formattedCurrentPayroll = currentPayroll
		? {
				amount: toNumber(currentPayroll.netAmount),
				status: currentPayroll.status,
			}
		: null;

	const formattedLastPayment = lastPayment
		? {
				amount: toNumber(lastPayment.amount),
				date: lastPayment.createdAt,
			}
		: null;

	return {
		myTasks,
		completedTasks,
		pendingSubmissions,
		currentPayroll: formattedCurrentPayroll,
		lastPayment: formattedLastPayment,
	};
};

const getEmployeeAnalytics = async (user: IRequestUser) => {
	const orgId = user.organizationId;

	const [totalByStatus, recentHires, departmentDistribution] =
		await Promise.all([
			prisma.employee.groupBy({
				by: ["status"],
				where: { organizationId: orgId },
				_count: true,
			}),
			prisma.employee.findMany({
				where: { organizationId: orgId },
				include: { user: { omit: { password: true } } },
				orderBy: { createdAt: "desc" },
				take: 5,
			}),
			prisma.department.findMany({
				where: { organizationId: orgId },
				include: { _count: { select: { employees: true } } },
			}),
		]);

	const byDepartment = departmentDistribution.map((d) => ({
		department: d.name,
		count: d._count.employees,
	}));

	return {
		byStatus: totalByStatus,
		recentHires,
		byDepartment,
	};
};

const getProjectAnalytics = async (user: IRequestUser) => {
	const orgId = user.organizationId;

	const [totalByStatus, projectStats, recentProjects] = await Promise.all([
		prisma.project.groupBy({
			by: ["status"],
			where: { organizationId: orgId },
			_count: true,
		}),
		prisma.project.findMany({
			where: { organizationId: orgId },
			include: {
				_count: { select: { tasks: true } },
			},
		}),
		prisma.project.findMany({
			where: { organizationId: orgId },
			orderBy: { createdAt: "desc" },
			take: 5,
		}),
	]);

	const totalTasks = projectStats.reduce((sum, p) => sum + p._count.tasks, 0);
	const avgTasksPerProject =
		projectStats.length > 0 ? totalTasks / projectStats.length : 0;

	return {
		byStatus: totalByStatus,
		totalProjects: projectStats.length,
		avgTasksPerProject: Math.round(avgTasksPerProject * 100) / 100,
		recentProjects,
	};
};

const getPayrollAnalytics = async (user: IRequestUser) => {
	const orgId = user.organizationId;

	const [statusCounts, totalAmounts, monthlyTrend] = await Promise.all([
		prisma.payroll.groupBy({
			by: ["status"],
			where: { organizationId: orgId },
			_count: true,
			_sum: { netAmount: true },
		}),
		prisma.payroll.aggregate({
			where: { organizationId: orgId },
			_sum: { grossAmount: true, deductions: true, netAmount: true },
			_count: true,
		}),
		prisma.payroll.groupBy({
			by: ["periodStart"],
			where: { organizationId: orgId },
			_sum: { netAmount: true },
			_count: true,
			orderBy: { periodStart: "desc" },
			take: 6,
		}),
	]);

	const byStatus = statusCounts.map((s) => ({
		...s,
		totalAmount: toNumber(s._sum.netAmount),
	}));

	const totals = {
		grossAmount: toNumber(totalAmounts._sum.grossAmount),
		deductions: toNumber(totalAmounts._sum.deductions),
		netAmount: toNumber(totalAmounts._sum.netAmount),
		count: totalAmounts._count,
	};

	const monthly = monthlyTrend.map((m) => ({
		period: m.periodStart,
		total: toNumber(m._sum.netAmount),
		count: m._count,
	}));

	return {
		byStatus,
		totals,
		monthlyTrend: monthly,
	};
};

const getPaymentAnalytics = async (user: IRequestUser) => {
	const orgId = user.organizationId;

	const [statusCounts, totalAmounts, byGateway] = await Promise.all([
		prisma.payment.groupBy({
			by: ["status"],
			where: { organizationId: orgId },
			_count: true,
			_sum: { amount: true },
		}),
		prisma.payment.aggregate({
			where: { organizationId: orgId, status: "COMPLETED" },
			_sum: { amount: true },
			_count: true,
		}),
		prisma.payment.groupBy({
			by: ["gateway"],
			where: { organizationId: orgId },
			_count: true,
			_sum: { amount: true },
		}),
	]);

	const byStatus = statusCounts.map((s) => ({
		...s,
		totalAmount: toNumber(s._sum.amount),
	}));

	const completed = {
		totalAmount: toNumber(totalAmounts._sum.amount),
		count: totalAmounts._count,
	};

	const gateway = byGateway.map((g) => ({
		...g,
		totalAmount: toNumber(g._sum.amount),
	}));

	return {
		byStatus,
		completed,
		byGateway: gateway,
	};
};

export const AnalyticsService = {
	getDashboard,
	getEmployeeAnalytics,
	getProjectAnalytics,
	getPayrollAnalytics,
	getPaymentAnalytics,
};
