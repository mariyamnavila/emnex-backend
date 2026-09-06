import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const router = Router();

router.get(
	"/my",
	auth(),
	checkPermission("task.view"),
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
	checkPermission("task.update"),
	validateRequest(TaskValidation.TaskStatusUpdateZodSchema),
	TaskController.updateTaskStatus,
);

router.get(
	"/:id/submissions",
	auth(),
	checkPermission("task.view", "submission.view"),
	TaskController.getTaskSubmissions,
);

export const TaskRoutes = router;
