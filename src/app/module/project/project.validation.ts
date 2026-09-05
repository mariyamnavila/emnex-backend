import { z } from "zod";

const CreateProjectZodSchema = z.object({
	name: z
		.string()
		.min(2, "Project name must be at least 2 characters")
		.max(200, "Project name must be at most 200 characters"),
	description: z.string().max(2000).optional(),
	startDate: z.iso.datetime("Invalid date format").optional(),
	endDate: z.iso.datetime("Invalid date format").optional(),
	budget: z.number().positive("Budget must be positive").optional(),
});

const UpdateProjectZodSchema = z.object({
	name: z
		.string()
		.min(2, "Project name must be at least 2 characters")
		.max(200, "Project name must be at most 200 characters")
		.optional(),
	description: z.string().max(2000).optional(),
	startDate: z.iso.datetime("Invalid date format").optional(),
	endDate: z.iso.datetime("Invalid date format").optional(),
	budget: z.number().positive("Budget must be positive").optional(),
	status: z
		.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"])
		.optional(),
});

export const ProjectValidation = {
	CreateProjectZodSchema,
	UpdateProjectZodSchema,
};
