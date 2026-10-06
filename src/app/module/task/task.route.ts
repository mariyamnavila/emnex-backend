import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkAnyPermission, checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const router = Router();

router.get(
	"/my",
	auth(),
	checkPermission("task.view_own"),
	TaskController.getMyTasks,
);

router.post(
	"/",
	auth(),
	checkPermission("task.create"),
	validateRequest(TaskValidation.CreateTaskZodSchema),
	TaskController.createTask,
);

router.get(
	"/",
	auth(),
	checkPermission("task.view"),
	TaskController.getAllTasks,
);

router.get(
	"/:id",
	auth(),
	checkPermission("task.view"),
	TaskController.getTaskById,
);

router.patch(
	"/:id",
	auth(),
	checkPermission("task.update"),
	validateRequest(TaskValidation.UpdateTaskZodSchema),
	TaskController.updateTask,
);

router.delete(
	"/:id",
	auth(),
	checkPermission("task.delete"),
	TaskController.deleteTask,
);

router.post(
	"/:id/assign",
	auth(),
	checkPermission("task.assign"),
	validateRequest(TaskValidation.TaskAssignZodSchema),
	TaskController.assignTask,
);

router.patch(
	"/:id/status",
	auth(),
	// Assignees move their own task (task.update_own); managers move any (task.update)
	checkAnyPermission("task.update_own", "task.update"),
	validateRequest(TaskValidation.TaskStatusUpdateZodSchema),
	TaskController.updateTaskStatus,
);

router.get(
	"/:id/submissions",
	auth(),
	// Assignee sees their own task's hours (task.view_own); managers see any (task.view).
	// The service scopes view_own callers to their own task.
	checkAnyPermission("task.view_own", "task.view"),
	TaskController.getTaskSubmissions,
);

export const TaskRoutes = router;
