export interface IPayrollGeneratePayload {
	employeeId: string;
	periodStart: string;
	periodEnd: string;
	deductions?: number;
}

export interface IPayrollQueryParams {
	page?: number;
	limit?: number;
	status?: string;
	employeeId?: string;
}
