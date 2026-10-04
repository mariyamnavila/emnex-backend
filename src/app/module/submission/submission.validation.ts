import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;

const hoursWorkedSchema = z
	.number()
	.positive("Hours worked must be positive")
	.max(24, "You can't log more than 24 hours for one day");

// A day ahead of UTC is allowed so "today" works in every time zone
const workDateSchema = z.iso
	.datetime("Invalid date format")
	.refine((value) => new Date(value).getTime() <= Date.now() + DAY_MS, "You can't log hours for a future date");

const CreateSubmissionZodSchema = z.object({
	taskId: z.uuid("Invalid task ID"),
	description: z
		.string()
		.min(10, "Description must be at least 10 characters")
		.max(5000, "Description must be at most 5000 characters"),
	hoursWorked: hoursWorkedSchema,
	workDate: workDateSchema,
});

const UpdateSubmissionZodSchema = z.object({
	description: z
		.string()
		.min(10, "Description must be at least 10 characters")
		.max(5000, "Description must be at most 5000 characters")
		.optional(),
	hoursWorked: hoursWorkedSchema.optional(),
	workDate: workDateSchema.optional(),
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
