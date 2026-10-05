export interface IPayrollGeneratePayload {
	employeeId: string;
	periodStart: string;
	periodEnd: string;
	deductions?: number;
	/** Manual gross override for special cases (PTO, bonus, 0-hours) — skips the hours/salary calc */
	grossAmount?: number;
}

export interface IPayrollQueryParams {
	page?: number;
	limit?: number;
	status?: string;
	employeeId?: string;
}
