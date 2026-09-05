import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const router = Router();

router.get("/my", auth(), TaskController.getMyTasks);

router.post(
	"/",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(TaskValidation.CreateTaskZodSchema),
	TaskController.createTask,
);

router.get("/", auth(), TaskController.getAllTasks);

router.get("/:id", auth(), TaskController.getTaskById);

router.patch(
	"/:id",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(TaskValidation.UpdateTaskZodSchema),
	TaskController.updateTask,
);

router.delete("/:id", auth("ADMIN"), TaskController.deleteTask);

router.post(
	"/:id/assign",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(TaskValidation.TaskAssignZodSchema),
	TaskController.assignTask,
);

router.patch(
	"/:id/status",
	auth(),
	validateRequest(TaskValidation.TaskStatusUpdateZodSchema),
	TaskController.updateTaskStatus,
);

router.get("/:id/submissions", auth(), TaskController.getTaskSubmissions);

export const TaskRoutes = router;
