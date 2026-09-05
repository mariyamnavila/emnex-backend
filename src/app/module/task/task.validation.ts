import { z } from "zod";

const CreateTaskZodSchema = z.object({
	projectId: z.string().uuid("Invalid project ID"),
	employeeId: z.string().uuid("Invalid employee ID"),
	title: z
		.string()
		.min(2, "Title must be at least 2 characters")
		.max(200, "Title must be at most 200 characters"),
	description: z.string().max(5000).optional(),
	estimatedHours: z.number().positive("Estimated hours must be positive").optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
	dueDate: z.string().datetime("Invalid date format").optional(),
});

const UpdateTaskZodSchema = z.object({
	title: z
		.string()
		.min(2, "Title must be at least 2 characters")
		.max(200, "Title must be at most 200 characters")
		.optional(),
	description: z.string().max(5000).optional(),
	estimatedHours: z.number().positive("Estimated hours must be positive").optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
	dueDate: z.string().datetime("Invalid date format").optional(),
});

const TaskStatusUpdateZodSchema = z.object({
	status: z.enum(["TODO", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "COMPLETED"]),
});

const TaskAssignZodSchema = z.object({
	employeeId: z.string().uuid("Invalid employee ID"),
});

export const TaskValidation = {
	CreateTaskZodSchema,
	UpdateTaskZodSchema,
	TaskStatusUpdateZodSchema,
	TaskAssignZodSchema,
};
