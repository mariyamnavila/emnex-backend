import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PayrollController } from "./payroll.controller";
import { PayrollValidation } from "./payroll.validation";

const router = Router();

router.get("/my", auth(), PayrollController.getMyPayrolls);

router.post(
	"/generate",
	auth("ADMIN", "HR_MANAGER", "FINANCE_MANAGER"),
	validateRequest(PayrollValidation.GeneratePayrollZodSchema),
	PayrollController.generatePayroll,
);

router.get("/", auth("ADMIN", "HR_MANAGER", "FINANCE_MANAGER"), PayrollController.getAllPayrolls);

router.get("/:id", auth(), PayrollController.getPayrollById);

router.post(
	"/:id/approve",
	auth("ADMIN", "HR_MANAGER", "FINANCE_MANAGER"),
	PayrollController.approvePayroll,
);

router.post(
	"/:id/reject",
	auth("ADMIN", "HR_MANAGER", "FINANCE_MANAGER"),
	PayrollController.rejectPayroll,
);

export const PayrollRoutes = router;
