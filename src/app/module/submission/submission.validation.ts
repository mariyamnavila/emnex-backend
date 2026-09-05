import { z } from "zod";

const CreateSubmissionZodSchema = z.object({
	taskId: z.uuid("Invalid task ID"),
	description: z
		.string()
		.min(10, "Description must be at least 10 characters")
		.max(5000, "Description must be at most 5000 characters"),
	hoursWorked: z.number().positive("Hours worked must be positive"),
	workDate: z.iso.datetime("Invalid date format"),
});

const UpdateSubmissionZodSchema = z.object({
	description: z
		.string()
		.min(10, "Description must be at least 10 characters")
		.max(5000, "Description must be at most 5000 characters")
		.optional(),
	hoursWorked: z.number().positive("Hours worked must be positive").optional(),
	workDate: z.iso.datetime("Invalid date format").optional(),
});

const RejectSubmissionZodSchema = z.object({
	reason: z
		.string()
		.min(10, "Reason must be at least 10 characters")
		.max(500, "Reason must be at most 500 characters"),
});

export const SubmissionValidation = {
	CreateSubmissionZodSchema,
	UpdateSubmissionZodSchema,
	RejectSubmissionZodSchema,
};
