import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrganizationController } from "./organization.controller";
import { OrganizationValidation } from "./organization.validation";

const router = Router();

router.get("/me", auth(), OrganizationController.getMyOrganization);

router.get("/:id", auth(), OrganizationController.getOrganizationById);

router.patch(
	"/:id",
	auth("ADMIN"),
	validateRequest(OrganizationValidation.UpdateOrganizationZodSchema),
	OrganizationController.updateOrganization,
);

router.get("/:id/stats", auth(), OrganizationController.getOrganizationStats);

export const OrganizationRoutes = router;
