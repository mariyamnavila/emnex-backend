import { z } from "zod";

const CreateRoleZodSchema = z.object({
	name: z
		.string()
		.min(2, "Role name must be at least 2 characters")
		.max(50, "Role name must be at most 50 characters"),
	description: z.string().max(200).optional(),
	permissionIds: z
		.array(z.uuid("Invalid permission ID"))
		.min(1, "A role needs at least one permission"),
});

const UpdateRoleZodSchema = z.object({
	name: z
		.string()
		.min(2, "Role name must be at least 2 characters")
		.max(50, "Role name must be at most 50 characters")
		.optional(),
	description: z.string().max(200).optional(),
});

const AssignPermissionsZodSchema = z.object({
	permissionIds: z
		.array(z.uuid("Invalid permission ID"))
		.min(1, "At least one permission is required"),
});

export const RoleValidation = {
	CreateRoleZodSchema,
	UpdateRoleZodSchema,
	AssignPermissionsZodSchema,
};
