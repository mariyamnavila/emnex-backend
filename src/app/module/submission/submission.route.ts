import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { SubmissionController } from "./submission.controller";
import { SubmissionValidation } from "./submission.validation";

const router = Router();

router.get(
	"/my",
	auth(),
	checkPermission("submission.view"),
	SubmissionController.getMySubmissions,
);

router.post(
	"/",
	auth(),
	checkPermission("submission.create"),
	validateRequest(SubmissionValidation.CreateSubmissionZodSchema),
	SubmissionController.createSubmission,
);

router.get(
	"/",
	auth(),
	checkPermission("submission.view"),
	SubmissionController.getAllSubmissions,
);

router.get(
	"/:id",
	auth(),
	checkPermission("submission.view"),
	SubmissionController.getSubmissionById,
);

router.patch(
	"/:id",
	auth(),
	checkPermission("submission.update"),
	validateRequest(SubmissionValidation.UpdateSubmissionZodSchema),
	SubmissionController.updateSubmission,
);

router.post(
	"/:id/approve",
	auth(),
	checkPermission("submission.approve"),
	SubmissionController.approveSubmission,
);

router.post(
	"/:id/reject",
	auth(),
	checkPermission("submission.reject"),
	validateRequest(SubmissionValidation.RejectSubmissionZodSchema),
	SubmissionController.rejectSubmission,
);

export const SubmissionRoutes = router;
