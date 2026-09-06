export interface IPaymentCreatePayload {
	payrollId: string;
	currency?: string;
}

export interface IPaymentQueryParams {
	page?: number;
	limit?: number;
	status?: string;
	employeeId?: string;
}
