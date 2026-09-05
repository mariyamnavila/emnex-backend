import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ProjectController } from "./project.controller";
import { ProjectValidation } from "./project.validation";

const router = Router();

router.post(
	"/",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(ProjectValidation.CreateProjectZodSchema),
	ProjectController.createProject,
);

router.get("/", auth(), ProjectController.getAllProjects);

router.get("/:id", auth(), ProjectController.getProjectById);

router.patch(
	"/:id",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(ProjectValidation.UpdateProjectZodSchema),
	ProjectController.updateProject,
);

router.delete("/:id", auth("ADMIN"), ProjectController.deleteProject);

router.get("/:id/tasks", auth(), ProjectController.getProjectTasks);

router.get("/:id/stats", auth(), ProjectController.getProjectStats);

export const ProjectRoutes = router;
