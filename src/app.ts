import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
import { jwtUtils } from "./app/utils/jwt";

const app: Application = express();

// Behind Vercel's proxy: use the client IP from X-Forwarded-For for rate limiting
if (config.is_vercel) {
	app.set("trust proxy", 1);
}

// Security headers
app.use(helmet());

// Before the limiters, so 429 responses are readable by the browser
app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Raw body for Stripe signature checks (express.json skips already-read bodies).
// Parsed before the limiters so they can tell users apart.
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const tooManyRequests = (message: string) => ({
	success: false,
	statusCode: 429,
	message,
});

const tokenUserId = (token: string | undefined, secret: string) => {
	if (!token) return undefined;
	const result = jwtUtils.verifyToken(token, secret);
	return result.success ? (result.data?.userId as string | undefined) : undefined;
};

// The frontend forwards /api/v1 through its own server, so every request can share
// one IP: limit signed-in users per account and only anonymous traffic per IP
const sessionKey = (req: Request) => {
	const header = req.headers.authorization;
	const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
	const userId =
		tokenUserId(req.cookies?.accessToken ?? bearer, config.jwt_access_secret) ??
		tokenUserId(req.cookies?.refreshToken, config.jwt_refresh_secret);
	return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 300,
	keyGenerator: sessionKey,
	message: tooManyRequests("Too many requests, please try again after 15 minutes"),
});
app.use("/api", limiter);

// Stricter limit where credentials are checked; counted per email so guessing one
// account's password can't lock everyone else out
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	keyGenerator: (req) => {
		const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
		return email ? `email:${email}` : sessionKey(req);
	},
	message: tooManyRequests(
		"Too many authentication attempts, please try again after 15 minutes",
	),
});
app.use(
	["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/change-password"],
	authLimiter,
);

// Routes
app.use("/api/v1/auth", AuthRoutes);
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
