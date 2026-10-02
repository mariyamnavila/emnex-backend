import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

// Reconnecting is slow, so keep idle connections longer than pg's 10 s default
const adapter = new PrismaPg({
	connectionString,
	max: 10,
	idleTimeoutMillis: 5 * 60 * 1000,
	connectionTimeoutMillis: 30 * 1000,
	keepAlive: true,
});
const prisma = new PrismaClient({ adapter });

export { prisma };
