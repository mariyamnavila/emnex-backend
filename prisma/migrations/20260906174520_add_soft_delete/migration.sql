-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "deletedAt" TIMESTAMP(3);
