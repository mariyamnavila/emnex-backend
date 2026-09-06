import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { AuditLogController } from "./audit-log.controller";

const router = Router();

router.get("/", auth("ADMIN", "HR_MANAGER"), AuditLogController.getAllAuditLogs);
router.get("/:id", auth("ADMIN", "HR_MANAGER"), AuditLogController.getAuditLogById);

export const AuditLogRoutes = router;
