import httpStatus from "http-status";
import { AppError } from "./AppError";

export const canBeAssignedTasks = (status: string) => {
	return status === "ACTIVE";
};

export const canWork = (status: string) => {
	return status === "ACTIVE";
};

export const canViewTasks = (status: string) => {
	return status === "ACTIVE" || status === "INACTIVE";
};

export const canViewSubmissions = (status: string) => {
	return status === "ACTIVE" || status === "INACTIVE";
};

export const validateEmployeeCanAssign = (status: string) => {
	if (!canBeAssignedTasks(status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot assign task to an employee with ${status} status`,
		);
	}
};

export const validateEmployeeCanWork = (status: string) => {
	if (!canWork(status)) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Your account is ${status.toLowerCase()}. You cannot perform this action.`,
		);
	}
};

export const validateEmployeeCanViewTasks = (status: string) => {
	if (!canViewTasks(status)) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Your account is ${status.toLowerCase()}. You cannot view tasks.`,
		);
	}
};

export const validateEmployeeCanViewSubmissions = (status: string) => {
	if (!canViewSubmissions(status)) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`Your account is ${status.toLowerCase()}. You cannot view submissions.`,
		);
	}
};
