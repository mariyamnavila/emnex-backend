import type { Prisma } from "../../generated/prisma/client";

// The signed-in user as auth() loads it once per request (reuse it instead of re-querying)
export const accountInclude = {
	role: { include: { permissions: { include: { permission: true } } } },
	employee: true,
	organization: true,
} as const;

export type IAccount = Prisma.UserGetPayload<{ include: typeof accountInclude }>;

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
			account?: IAccount;
		}
	}
}
