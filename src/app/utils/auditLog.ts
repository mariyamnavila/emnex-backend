import { InputJsonValue } from "@prisma/client/runtime/client";
import { prisma } from "../lib/prisma";

export const AuditAction = {
	// Auth
	LOGIN: "LOGIN",
	LOGIN_FAILED: "LOGIN_FAILED",
	GOOGLE_LOGIN: "GOOGLE_LOGIN",
	LOGOUT: "LOGOUT",
	PASSWORD_CHANGED: "PASSWORD_CHANGED",

	// Employee
	CREATE_EMPLOYEE: "CREATE_EMPLOYEE",
	UPDATE_EMPLOYEE: "UPDATE_EMPLOYEE",
	DELETE_EMPLOYEE: "DELETE_EMPLOYEE",
	CHANGE_EMPLOYEE_ROLE: "CHANGE_EMPLOYEE_ROLE",
	CHANGE_EMPLOYEE_STATUS: "CHANGE_EMPLOYEE_STATUS",

	// Department
	CREATE_DEPARTMENT: "CREATE_DEPARTMENT",
	UPDATE_DEPARTMENT: "UPDATE_DEPARTMENT",
	DELETE_DEPARTMENT: "DELETE_DEPARTMENT",

	// Role
	CREATE_ROLE: "CREATE_ROLE",
	UPDATE_ROLE: "UPDATE_ROLE",
	DELETE_ROLE: "DELETE_ROLE",
	ASSIGN_PERMISSIONS: "ASSIGN_PERMISSIONS",

	// Project
	CREATE_PROJECT: "CREATE_PROJECT",
	UPDATE_PROJECT: "UPDATE_PROJECT",
	DELETE_PROJECT: "DELETE_PROJECT",
	CHANGE_PROJECT_STATUS: "CHANGE_PROJECT_STATUS",

	// Task
	CREATE_TASK: "CREATE_TASK",
	ASSIGN_TASK: "ASSIGN_TASK",
	CHANGE_TASK_STATUS: "CHANGE_TASK_STATUS",
	DELETE_TASK: "DELETE_TASK",

	// Submission
	SUBMIT_WORK: "SUBMIT_WORK",
	APPROVE_WORK: "APPROVE_WORK",
	REJECT_WORK: "REJECT_WORK",

	// Payroll
	GENERATE_PAYROLL: "GENERATE_PAYROLL",
	APPROVE_PAYROLL: "APPROVE_PAYROLL",
	REJECT_PAYROLL: "REJECT_PAYROLL",

	// Payment
	PAYMENT_INITIATED: "PAYMENT_INITIATED",
	PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
	PAYMENT_FAILED: "PAYMENT_FAILED",
} as const;

type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

interface IAuditLogData {
	user: {
		userId: string;
		organizationId: string;
	};
	action: AuditActionType;
	entity: string;
	entityId?: string;
	metadata?: unknown;
	ipAddress?: string;
}

export const createAuditLog = async (data: IAuditLogData) => {
	try {
		await prisma.auditLog.create({
			data: {
				organizationId: data.user.organizationId,
				userId: data.user.userId,
				action: data.action,
				entity: data.entity,
				entityId: data.entityId,
				metadata: data.metadata as InputJsonValue | undefined,
				ipAddress: data.ipAddress,
			},
		});
	} catch (error) {
		console.error("Failed to create audit log:", error);
	}
};
