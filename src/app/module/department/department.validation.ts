import { z } from "zod";

const CreateDepartmentZodSchema = z.object({
	name: z
		.string()
		.min(2, "Department name must be at least 2 characters")
		.max(100, "Department name must be at most 100 characters"),
	description: z.string().max(500).optional(),
});

const UpdateDepartmentZodSchema = z.object({
	name: z
		.string()
		.min(2, "Department name must be at least 2 characters")
		.max(100, "Department name must be at most 100 characters")
		.optional(),
	description: z.string().max(500).optional(),
});

export const DepartmentValidation = {
	CreateDepartmentZodSchema,
	UpdateDepartmentZodSchema,
};
