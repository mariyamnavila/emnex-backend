import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkAnyPermission, checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { EmployeeController } from "./employee.controller";
import { EmployeeValidation } from "./employee.validation";

const router = Router();

router.post(
	"/",
	auth(),
	checkPermission("employee.create"),
	validateRequest(EmployeeValidation.CreateEmployeeZodSchema),
	EmployeeController.createEmployee,
);

// Pay-free roster for task-assignment pickers (before "/:id" so it isn't shadowed)
router.get(
	"/options",
	auth(),
	checkAnyPermission("employee.view", "task.assign", "task.create"),
	EmployeeController.getEmployeeOptions,
);

router.get(
	"/",
	auth(),
	checkPermission("employee.view"),
	EmployeeController.getAllEmployees,
);

router.get(
	"/:id",
	auth(),
	checkPermission("employee.view"),
	EmployeeController.getEmployeeById,
);

router.patch(
	"/:id",
	auth(),
	checkPermission("employee.update"),
	validateRequest(EmployeeValidation.UpdateEmployeeZodSchema),
	EmployeeController.updateEmployee,
);

router.delete(
	"/:id",
	auth(),
	checkPermission("employee.delete"),
	EmployeeController.deleteEmployee,
);

router.get(
	"/:id/stats",
	auth(),
	checkPermission("employee.view"),
	EmployeeController.getEmployeeStats,
);

router.post(
	"/:id/resend-credentials",
	auth(),
	checkPermission("employee.create"),
	EmployeeController.resendCredentials,
);

export const EmployeeRoutes = router;
