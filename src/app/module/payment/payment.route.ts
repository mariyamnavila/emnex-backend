import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

router.post("/webhook", PaymentController.handleWebhook);

router.get(
	"/my",
	auth(),
	checkPermission("payment.view_own"),
	PaymentController.getMyPayments,
);

router.post(
	"/",
	auth(),
	checkPermission("payment.create"),
	validateRequest(PaymentValidation.CreatePaymentZodSchema),
	PaymentController.createCheckoutSession,
);

router.get(
	"/",
	auth(),
	checkPermission("payment.view"),
	PaymentController.getAllPayments,
);

router.get(
	"/:id",
	auth(),
	checkPermission("payment.view"),
	PaymentController.getPaymentById,
);

export const PaymentRoutes = router;
