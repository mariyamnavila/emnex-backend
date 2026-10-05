import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkAnyPermission, checkPermission } from "../../middleware/checkPermission";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

// The cross-resource overview stays on analytics.view. The per-resource stat
// cards are just counts of data you can already view, so they also accept that
// resource's view permission (a role with employee.view sees employee stats).
router.get(
	"/dashboard",
	auth(),
	checkPermission("analytics.view"),
	AnalyticsController.getDashboard,
);
router.get(
	"/employees",
	auth(),
	checkAnyPermission("analytics.view", "employee.view"),
	AnalyticsController.getEmployeeAnalytics,
);
router.get(
	"/projects",
	auth(),
	checkAnyPermission("analytics.view", "project.view"),
	AnalyticsController.getProjectAnalytics,
);
router.get(
	"/payroll",
	auth(),
	checkAnyPermission("analytics.view", "payroll.view"),
	AnalyticsController.getPayrollAnalytics,
);
router.get(
	"/payments",
	auth(),
	checkAnyPermission("analytics.view", "payment.view"),
	AnalyticsController.getPaymentAnalytics,
);

export const AnalyticsRoutes = router;
