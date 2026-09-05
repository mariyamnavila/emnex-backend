import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RoleController } from "./role.controller";
import { RoleValidation } from "./role.validation";

const router = Router();

// Role CRUD
router.post(
	"/",
	auth("ADMIN"),
	validateRequest(RoleValidation.CreateRoleZodSchema),
	RoleController.createRole,
);

router.get("/", auth(), RoleController.getAllRoles);

router.get("/:id", auth(), RoleController.getRoleById);

router.patch(
	"/:id",
	auth("ADMIN"),
	validateRequest(RoleValidation.UpdateRoleZodSchema),
	RoleController.updateRole,
);

router.delete("/:id", auth("ADMIN"), RoleController.deleteRole);

// Permission management
router.get("/permissions/all", auth(), RoleController.getAllPermissions);

router.get("/:roleId/permissions", auth(), RoleController.getRolePermissions);

router.post(
	"/:roleId/permissions",
	auth("ADMIN"),
	validateRequest(RoleValidation.AssignPermissionsZodSchema),
	RoleController.assignPermissions,
);

router.delete(
	"/:roleId/permissions/:permissionId",
	auth("ADMIN"),
	RoleController.removePermission,
);

export const RoleRoutes = router;
