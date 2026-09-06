import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { checkPermission } from "../../middleware/checkPermission";
import { validateRequest } from "../../middleware/validateRequest";
import { RoleController } from "./role.controller";
import { RoleValidation } from "./role.validation";

const router = Router();

// Role CRUD
router.post(
	"/",
	auth(),
	checkPermission("role.create"),
	validateRequest(RoleValidation.CreateRoleZodSchema),
	RoleController.createRole,
);

router.get("/", auth(), checkPermission("role.view"), RoleController.getAllRoles);

// Permission management (must be before /:id)
router.get("/permissions/all", auth(), checkPermission("permission.view"), RoleController.getAllPermissions);

router.get("/:id", auth(), checkPermission("role.view"), RoleController.getRoleById);

router.patch(
	"/:id",
	auth(),
	checkPermission("role.update"),
	validateRequest(RoleValidation.UpdateRoleZodSchema),
	RoleController.updateRole,
);

router.delete("/:id", auth(), checkPermission("role.delete"), RoleController.deleteRole);

router.get("/:roleId/permissions", auth(), checkPermission("permission.view"), RoleController.getRolePermissions);

router.post(
	"/:roleId/permissions",
	auth(),
	checkPermission("permission.assign"),
	validateRequest(RoleValidation.AssignPermissionsZodSchema),
	RoleController.assignPermissions,
);

router.delete(
	"/:roleId/permissions/:permissionId",
	auth(),
	checkPermission("permission.assign"),
	RoleController.removePermission,
);

export const RoleRoutes = router;
