import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { seed } from "./app/utils/seed";

const PORT = config.port;

async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to the database successfully");

        await seed();
        console.log("Seed data completed");

        app.listen(PORT, () => {
            console.log(`WorkFlow ERP Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Error starting server:", error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

main();
