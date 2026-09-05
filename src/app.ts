import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { DepartmentRoutes } from "./app/module/department/department.route";
import { EmployeeRoutes } from "./app/module/employee/employee.route";
import { OrganizationRoutes } from "./app/module/organization/organization.route";
import { RoleRoutes } from "./app/module/role/role.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/organizations", OrganizationRoutes);
app.use("/api/v1/roles", RoleRoutes);
app.use("/api/v1/departments", DepartmentRoutes);
app.use("/api/v1/employees", EmployeeRoutes);

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
