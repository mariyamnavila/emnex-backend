import { z } from "zod";

// When both dates are given, the end can't come before the start.
const endNotBeforeStart = (data: { startDate?: string; endDate?: string }) =>
	!data.startDate || !data.endDate || new Date(data.endDate) >= new Date(data.startDate);
const endDateError = {
	message: "End date can't be before the start date",
	path: ["endDate"],
};

const CreateProjectZodSchema = z
	.object({
		name: z
			.string()
			.min(2, "Project name must be at least 2 characters")
			.max(200, "Project name must be at most 200 characters"),
		description: z.string().max(2000).optional(),
		startDate: z.iso.datetime("Invalid date format").optional(),
		endDate: z.iso.datetime("Invalid date format").optional(),
		budget: z.number().positive("Budget must be positive").optional(),
	})
	.refine(endNotBeforeStart, endDateError);

const UpdateProjectZodSchema = z
	.object({
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
	})
	.refine(endNotBeforeStart, endDateError);

export const ProjectValidation = {
	CreateProjectZodSchema,
	UpdateProjectZodSchema,
};
