export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: string;
	organizationId: string;
	permissions: string[];
}

declare global {
	namespace Express {
		interface Request {
			user?: IRequestUser;
		}
	}
}
