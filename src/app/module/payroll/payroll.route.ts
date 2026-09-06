import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { PayrollController } from "./payroll.controller";
import { PayrollValidation } from "./payroll.validation";

const router = Router();

router.get("/my", auth(), checkPermission("payroll.view_own"), PayrollController.getMyPayrolls);

router.post(
	"/generate",
	auth(),
	checkPermission("payroll.generate"),
	validateRequest(PayrollValidation.GeneratePayrollZodSchema),
	PayrollController.generatePayroll,
);

router.get("/", auth(), checkPermission("payroll.view"), PayrollController.getAllPayrolls);

router.get("/:id", auth(), checkPermission("payroll.view"), PayrollController.getPayrollById);

router.post(
	"/:id/approve",
	auth(),
	checkPermission("payroll.approve"),
	PayrollController.approvePayroll,
);

router.post(
	"/:id/reject",
	auth(),
	checkPermission("payroll.reject"),
	PayrollController.rejectPayroll,
);

export const PayrollRoutes = router;
