import { z } from "zod";

const GeneratePayrollZodSchema = z.object({
	employeeId: z.uuid("Invalid employee ID"),
	periodStart: z.iso.datetime("Invalid date format"),
	periodEnd: z.iso.datetime("Invalid date format"),
	deductions: z.number().min(0, "Deductions cannot be negative").optional(),
});

export const PayrollValidation = {
	GeneratePayrollZodSchema,
};
