import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";
import { AuditLogRoutes } from "./app/module/audit-log/audit-log.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { DepartmentRoutes } from "./app/module/department/department.route";
import { EmployeeRoutes } from "./app/module/employee/employee.route";
import { OrganizationRoutes } from "./app/module/organization/organization.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { PayrollRoutes } from "./app/module/payroll/payroll.route";
import { ProjectRoutes } from "./app/module/project/project.route";
import { RoleRoutes } from "./app/module/role/role.route";
import { SubmissionRoutes } from "./app/module/submission/submission.route";
import { TaskRoutes } from "./app/module/task/task.route";

const app: Application = express();

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: "Too many requests from this IP, please try again after 15 minutes",
});
app.use("/api", limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	message:
		"Too many authentication attempts, please try again after 15 minutes",
});

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", authLimiter, AuthRoutes);
app.use("/api/v1/organizations", OrganizationRoutes);
app.use("/api/v1/roles", RoleRoutes);
app.use("/api/v1/departments", DepartmentRoutes);
app.use("/api/v1/employees", EmployeeRoutes);
app.use("/api/v1/projects", ProjectRoutes);
app.use("/api/v1/tasks", TaskRoutes);
app.use("/api/v1/submissions", SubmissionRoutes);
app.use("/api/v1/payroll", PayrollRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);
app.use("/api/v1/audit-logs", AuditLogRoutes);

app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to EmNex System Backend",
	});
});

// Error handlers
app.use(globalErrorHandler);
app.use(notFound);

export default app;
