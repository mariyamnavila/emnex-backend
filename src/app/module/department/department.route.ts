import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { DepartmentController } from "./department.controller";
import { DepartmentValidation } from "./department.validation";

const router = Router();

router.post(
	"/",
	auth(),
	checkPermission("department.create"),
	validateRequest(DepartmentValidation.CreateDepartmentZodSchema),
	DepartmentController.createDepartment,
);

router.get(
	"/",
	auth(),
	checkPermission("department.view"),
	DepartmentController.getAllDepartments,
);

router.get(
	"/:id",
	auth(),
	checkPermission("department.view"),
	DepartmentController.getDepartmentById,
);

router.patch(
	"/:id",
	auth(),
	checkPermission("department.update"),
	validateRequest(DepartmentValidation.UpdateDepartmentZodSchema),
	DepartmentController.updateDepartment,
);

router.delete(
	"/:id",
	auth(),
	checkPermission("department.delete"),
	DepartmentController.deleteDepartment,
);

router.get(
	"/:id/employees",
	auth(),
	checkPermission("department.view"),
	DepartmentController.getDepartmentEmployees,
);

export const DepartmentRoutes = router;
