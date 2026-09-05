export interface ISubmissionCreatePayload {
	taskId: string;
	description: string;
	hoursWorked: number;
	workDate: string;
}

export interface ISubmissionUpdatePayload {
	description?: string;
	hoursWorked?: number;
	workDate?: string;
}

export interface ISubmissionRejectPayload {
	reason: string;
}

export interface ISubmissionQueryParams {
	page?: number;
	limit?: number;
	status?: string;
	taskId?: string;
	employeeId?: string;
}
