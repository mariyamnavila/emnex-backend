import { z } from "zod";

const UpdateOrganizationZodSchema = z.object({
	name: z
		.string()
		.min(2, "Organization name must be at least 2 characters")
		.max(100, "Organization name must be at most 100 characters")
		.optional(),
	slug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.max(100, "Slug must be at most 100 characters")
		.regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
		.optional(),
});

export const OrganizationValidation = {
	UpdateOrganizationZodSchema,
};
