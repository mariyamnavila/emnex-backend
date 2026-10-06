export interface IPayrollGeneratePayload {
	employeeId: string;
	periodStart: string;
	periodEnd: string;
	deductions?: number;
	/** Extra added on top of the calculated pay — bonus, PTO, or paying an hourly employee with no logged hours */
	extraAmount?: number;
}

export interface IPayrollQueryParams {
	page?: number;
	limit?: number;
	status?: string;
	employeeId?: string;
}
