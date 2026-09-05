import { Role } from "../../generated/prisma/client";

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
	organizationId: string;
}

declare global {
	namespace Express {
		interface Request {
			user?: IRequestUser;
		}
	}
}
