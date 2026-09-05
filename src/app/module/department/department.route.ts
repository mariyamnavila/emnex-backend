import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DepartmentController } from "./department.controller";
import { DepartmentValidation } from "./department.validation";

const router = Router();

router.post(
	"/",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(DepartmentValidation.CreateDepartmentZodSchema),
	DepartmentController.createDepartment,
);

router.get("/", auth(), DepartmentController.getAllDepartments);

router.get("/:id", auth(), DepartmentController.getDepartmentById);

router.patch(
	"/:id",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(DepartmentValidation.UpdateDepartmentZodSchema),
	DepartmentController.updateDepartment,
);

router.delete("/:id", auth("ADMIN"), DepartmentController.deleteDepartment);

router.get("/:id/employees", auth(), DepartmentController.getDepartmentEmployees);

export const DepartmentRoutes = router;
