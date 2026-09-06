import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { ProjectController } from "./project.controller";
import { ProjectValidation } from "./project.validation";

const router = Router();

router.post(
	"/",
	auth(),
	checkPermission("project.create"),
	validateRequest(ProjectValidation.CreateProjectZodSchema),
	ProjectController.createProject,
);

router.get("/", auth(), checkPermission("project.view"), ProjectController.getAllProjects);

router.get("/:id", auth(), checkPermission("project.view"), ProjectController.getProjectById);

router.patch(
	"/:id",
	auth(),
	checkPermission("project.update"),
	validateRequest(ProjectValidation.UpdateProjectZodSchema),
	ProjectController.updateProject,
);

router.delete("/:id", auth(), checkPermission("project.delete"), ProjectController.deleteProject);

router.get("/:id/tasks", auth(), checkPermission("project.view", "task.view"), ProjectController.getProjectTasks);

router.get("/:id/stats", auth(), checkPermission("project.view"), ProjectController.getProjectStats);

export const ProjectRoutes = router;
