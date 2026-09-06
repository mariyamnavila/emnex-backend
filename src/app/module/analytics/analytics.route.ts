import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get("/dashboard", auth(), AnalyticsController.getDashboard);
router.get("/employees", auth("ADMIN", "HR_MANAGER"), AnalyticsController.getEmployeeAnalytics);
router.get("/projects", auth("ADMIN", "HR_MANAGER"), AnalyticsController.getProjectAnalytics);
router.get("/payroll", auth("ADMIN", "FINANCE_MANAGER"), AnalyticsController.getPayrollAnalytics);
router.get("/payments", auth("ADMIN", "FINANCE_MANAGER"), AnalyticsController.getPaymentAnalytics);

export const AnalyticsRoutes = router;
