export interface IRoleCreatePayload {
	name: string;
	description?: string;
}

export interface IRoleUpdatePayload {
	name?: string;
	description?: string;
}

export interface IPermissionAssignPayload {
	permissionIds: string[];
}
