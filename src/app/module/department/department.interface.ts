export interface IDepartmentCreatePayload {
	name: string;
	description?: string;
}

export interface IDepartmentUpdatePayload {
	name?: string;
	description?: string;
}
