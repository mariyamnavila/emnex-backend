/**
 * One-off, idempotent migration for the explicit `_own` permission split.
 * Run once per environment:  npx tsx src/scripts/migrate-own-permissions.ts
 *
 * - Ensures the 3 new permissions exist (task.view_own, task.update_own, submission.view_own).
 * - Grants the self-service set to every system role (per-org + global): HR/Finance/Employee
 *   (so they can view/log/update their OWN work), and the 3 new perms to Admin.
 * - Removes the now-wrong "all" perms (task.view / task.update / submission.view) from the
 *   EMPLOYEE role, which is self-service only.
 * Safe to re-run. It only ADDS the self-service perms and REMOVES those 3 from Employee —
 * it never touches other (possibly customized) permissions on the management roles.
 */
import { prisma } from "../app/lib/prisma";

const NEW_PERMS = ["task.view_own", "task.update_own", "submission.view_own"];
const SELF_SERVICE = [
	"task.view_own",
	"task.update_own",
	"submission.view_own",
	"submission.create",
	"submission.update",
	"payroll.view_own",
	"payment.view_own",
];
const EMPLOYEE_REMOVE = ["task.view", "task.update", "submission.view"];

const run = async () => {
	await prisma.permission.createMany({
		data: NEW_PERMS.map((name) => ({ name })),
		skipDuplicates: true,
	});

	const permissions = await prisma.permission.findMany({ select: { id: true, name: true } });
	const idByName = new Map(permissions.map((p) => [p.name, p.id]));

	const systemRoles = await prisma.role.findMany({
		where: { isSystem: true },
		select: { id: true, name: true },
	});
	const idsOf = (name: string) => systemRoles.filter((r) => r.name === name).map((r) => r.id);

	const grant = async (roleIds: string[], names: string[]) => {
		for (const roleId of roleIds) {
			await prisma.rolePermission.createMany({
				data: names
					.filter((n) => idByName.has(n))
					.map((n) => ({ roleId, permissionId: idByName.get(n)! })),
				skipDuplicates: true,
			});
		}
	};

	await grant(idsOf("HR_MANAGER"), SELF_SERVICE);
	await grant(idsOf("FINANCE_MANAGER"), SELF_SERVICE);
	await grant(idsOf("EMPLOYEE"), SELF_SERVICE);
	await grant(idsOf("ADMIN"), NEW_PERMS);

	const employeeRoleIds = idsOf("EMPLOYEE");
	const removeIds = EMPLOYEE_REMOVE.map((n) => idByName.get(n)).filter(Boolean) as string[];
	const removed = await prisma.rolePermission.deleteMany({
		where: { roleId: { in: employeeRoleIds }, permissionId: { in: removeIds } },
	});

	console.log(
		`Migrated ${systemRoles.length} system roles. Removed ${removed.count} "all" perms from EMPLOYEE roles.`,
	);
};

run()
	.catch((error) => {
		console.error("Migration failed:", error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
