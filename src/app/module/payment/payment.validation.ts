import { z } from "zod";

const CreatePaymentZodSchema = z.object({
	payrollId: z.string().uuid("Invalid payroll ID"),
	currency: z.string().optional(),
});

export const PaymentValidation = {
	CreatePaymentZodSchema,
};
