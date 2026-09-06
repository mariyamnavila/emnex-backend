import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

router.post("/webhook", PaymentController.handleWebhook);

router.get("/my", auth(), PaymentController.getMyPayments);

router.post(
	"/",
	auth("ADMIN", "HR_MANAGER", "FINANCE_MANAGER"),
	validateRequest(PaymentValidation.CreatePaymentZodSchema),
	PaymentController.createCheckoutSession,
);

router.get("/", auth("ADMIN", "HR_MANAGER", "FINANCE_MANAGER"), PaymentController.getAllPayments);

router.get("/:id", auth(), PaymentController.getPaymentById);

export const PaymentRoutes = router;
