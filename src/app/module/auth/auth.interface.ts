import type { IRequestUser } from "../../interfaces";

export interface IRegisterPayload {
	organizationName: string;
	organizationSlug: string;
	name: string;
	email: string;
	password: string;
}

export interface ILoginPayload {
	email: string;
	password: string;
}

export interface IGoogleLoginPayload {
	idToken: string;
}

export interface IChangePasswordPayload {
	currentPassword: string;
	newPassword: string;
}

export type { IRequestUser };
