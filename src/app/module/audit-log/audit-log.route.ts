import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { AuditLogController } from "./audit-log.controller";

const router = Router();

router.get(
	"/",
	auth(),
	checkPermission("audit.view"),
	AuditLogController.getAllAuditLogs,
);
router.get(
	"/:id",
	auth(),
	checkPermission("audit.view"),
	AuditLogController.getAuditLogById,
);

export const AuditLogRoutes = router;
