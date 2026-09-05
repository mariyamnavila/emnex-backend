import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SubmissionController } from "./submission.controller";
import { SubmissionValidation } from "./submission.validation";

const router = Router();

router.get("/my", auth(), SubmissionController.getMySubmissions);

router.post(
	"/",
	auth(),
	validateRequest(SubmissionValidation.CreateSubmissionZodSchema),
	SubmissionController.createSubmission,
);

router.get("/", auth(), SubmissionController.getAllSubmissions);

router.get("/:id", auth(), SubmissionController.getSubmissionById);

router.patch(
	"/:id",
	auth(),
	validateRequest(SubmissionValidation.UpdateSubmissionZodSchema),
	SubmissionController.updateSubmission,
);

router.post(
	"/:id/approve",
	auth("ADMIN", "HR_MANAGER"),
	SubmissionController.approveSubmission,
);

router.post(
	"/:id/reject",
	auth("ADMIN", "HR_MANAGER"),
	validateRequest(SubmissionValidation.RejectSubmissionZodSchema),
	SubmissionController.rejectSubmission,
);

export const SubmissionRoutes = router;
