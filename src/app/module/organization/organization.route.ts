import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { OrganizationController } from "./organization.controller";
import { OrganizationValidation } from "./organization.validation";

const router = Router();

router.get("/me", auth(), OrganizationController.getMyOrganization);

router.get(
	"/:id",
	auth(),
	checkPermission("organization.view"),
	OrganizationController.getOrganizationById,
);

router.patch(
	"/:id",
	auth(),
	checkPermission("organization.update"),
	validateRequest(OrganizationValidation.UpdateOrganizationZodSchema),
	OrganizationController.updateOrganization,
);

router.get(
	"/:id/stats",
	auth(),
	checkPermission("organization.view"),
	OrganizationController.getOrganizationStats,
);

export const OrganizationRoutes = router;
