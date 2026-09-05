import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { EmployeeController } from "./employee.controller";
import { EmployeeValidation } from "./employee.validation";

const router = Router();

router.post(
	"/",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(EmployeeValidation.CreateEmployeeZodSchema),
	EmployeeController.createEmployee,
);

router.get("/", auth(), EmployeeController.getAllEmployees);

router.get("/:id", auth(), EmployeeController.getEmployeeById);

router.patch(
	"/:id",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(EmployeeValidation.UpdateEmployeeZodSchema),
	EmployeeController.updateEmployee,
);

router.delete("/:id", auth("ADMIN"), EmployeeController.deleteEmployee);

router.get("/:id/stats", auth(), EmployeeController.getEmployeeStats);

router.post("/:id/resend-credentials", auth("ADMIN"), EmployeeController.resendCredentials);

export const EmployeeRoutes = router;
