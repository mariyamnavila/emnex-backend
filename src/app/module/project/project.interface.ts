export interface IProjectCreatePayload {
	name: string;
	description?: string;
	startDate?: string;
	endDate?: string;
	budget?: number;
}

export interface IProjectUpdatePayload {
	name?: string;
	description?: string;
	startDate?: string;
	endDate?: string;
	budget?: number;
	status?: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
}

export interface IProjectQueryParams {
	page?: number;
	limit?: number;
	search?: string;
	status?: string;
}
