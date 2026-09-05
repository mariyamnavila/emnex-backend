import { z } from "zod";

const CreateEmployeeZodSchema = z.object({
	name: z
		.string()
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be at most 100 characters"),
	email: z.email("Invalid email address"),
	roleId: z.uuid("Invalid role ID"),
	departmentId: z.string().uuid("Invalid department ID").optional(),
	jobTitle: z
		.string()
		.min(2, "Job title must be at least 2 characters")
		.max(100, "Job title must be at most 100 characters"),
	salaryType: z.enum(["MONTHLY", "HOURLY"]),
	salary: z.number().positive("Salary must be positive").optional(),
	hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
	joiningDate: z.string().datetime("Invalid date format"),
});

const UpdateEmployeeZodSchema = z.object({
	departmentId: z.string().uuid("Invalid department ID").optional(),
	jobTitle: z
		.string()
		.min(2, "Job title must be at least 2 characters")
		.max(100, "Job title must be at most 100 characters")
		.optional(),
	salaryType: z.enum(["MONTHLY", "HOURLY"]).optional(),
	salary: z.number().positive("Salary must be positive").optional(),
	hourlyRate: z.number().positive("Hourly rate must be positive").optional(),
	status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"]).optional(),
});

export const EmployeeValidation = {
	CreateEmployeeZodSchema,
	UpdateEmployeeZodSchema,
};
