import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get(
	"/dashboard",
	auth(),
	checkPermission("analytics.view"),
	AnalyticsController.getDashboard,
);
router.get(
	"/employees",
	auth(),
	checkPermission("analytics.view"),
	AnalyticsController.getEmployeeAnalytics,
);
router.get(
	"/projects",
	auth(),
	checkPermission("analytics.view"),
	AnalyticsController.getProjectAnalytics,
);
router.get(
	"/payroll",
	auth(),
	checkPermission("analytics.view"),
	AnalyticsController.getPayrollAnalytics,
);
router.get(
	"/payments",
	auth(),
	checkPermission("analytics.view"),
	AnalyticsController.getPaymentAnalytics,
);

export const AnalyticsRoutes = router;
