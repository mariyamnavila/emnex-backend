export interface IEmployeeCreatePayload {
	name: string;
	email: string;
	roleId: string;
	departmentId?: string;
	jobTitle: string;
	salaryType: "MONTHLY" | "HOURLY";
	salary?: number;
	hourlyRate?: number;
	joiningDate: string;
}

export interface IEmployeeUpdatePayload {
	departmentId?: string;
	jobTitle?: string;
	salaryType?: "MONTHLY" | "HOURLY";
	salary?: number;
	hourlyRate?: number;
	status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "TERMINATED";
}

export interface IEmployeeQueryParams {
	page?: number;
	limit?: number;
	search?: string;
	departmentId?: string;
	status?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
