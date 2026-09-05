import z from "zod";

const RegisterZodSchema = z.object({
	organizationName: z
		.string()
		.min(2, "Organization name must be at least 2 characters"),
	organizationSlug: z
		.string()
		.min(2, "Slug must be at least 2 characters")
		.regex(
			/^[a-z0-9-]+$/,
			"Slug must only contain lowercase letters, numbers, and hyphens",
		),
	name: z.string().min(2, "Name must be at least 2 characters").max(150),
	email: z.email("Invalid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
});

const LoginZodSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

const ChangePasswordZodSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
		.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
		.regex(/[0-9]/, "Password must contain at least 1 number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least 1 special character",
		),
});

const GoogleLoginZodSchema = z.object({
	idToken: z.string().min(1, "Google ID token is required"),
});

export const AuthValidation = {
	RegisterZodSchema,
	LoginZodSchema,
	ChangePasswordZodSchema,
	GoogleLoginZodSchema,
};
