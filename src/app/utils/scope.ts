import { prisma } from "../lib/prisma";
import type { IRequestUser } from "../interfaces";

// Reviewers/managers (vs. plain employees) for ownership scoping. `task.view`
// and `submission.view` are shared with employees, so they can't distinguish
// "see all" from "see my own" — these management/review perms can.
// Who may view OTHER employees' submissions: reviewers (approve/reject) and
// payroll processors (they need approved hours to compute and preview pay).
export const SUBMISSION_VIEW_ALL = [
	"submission.approve",
	"submission.reject",
	"payroll.view",
	"payroll.generate",
];
export const TASK_MANAGE = [
	"task.create",
	"task.assign",
	"task.delete",
	"submission.approve",
	"submission.reject",
];

export const hasAnyPermission = (user: IRequestUser, perms: string[]): boolean =>
	perms.some((p) => user.permissions.includes(p));

// The caller's own employee id (null if they have no employee record)
export const getCallerEmployeeId = async (user: IRequestUser): Promise<string | null> => {
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
		select: { id: true },
	});
	return employee?.id ?? null;
};
