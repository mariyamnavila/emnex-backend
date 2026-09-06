export interface ITaskCreatePayload {
	projectId: string;
	employeeId: string;
	title: string;
	description?: string;
	estimatedHours?: number;
	priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	dueDate?: string;
}

export interface ITaskUpdatePayload {
	title?: string;
	description?: string;
	estimatedHours?: number;
	priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
	dueDate?: string;
}

export interface ITaskStatusUpdatePayload {
	status:
		| "TODO"
		| "IN_PROGRESS"
		| "SUBMITTED"
		| "APPROVED"
		| "REJECTED"
		| "COMPLETED";
}

export interface ITaskAssignPayload {
	employeeId: string;
}

export interface ITaskQueryParams {
	page?: number;
	limit?: number;
	search?: string;
	status?: string;
	priority?: string;
	projectId?: string;
	employeeId?: string;
}
