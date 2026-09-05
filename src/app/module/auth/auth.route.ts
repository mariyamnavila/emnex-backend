import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { upload } from "../../lib/multer";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	validateRequest(AuthValidation.RegisterZodSchema),
	AuthController.register,
);

router.post(
	"/login",
	validateRequest(AuthValidation.LoginZodSchema),
	AuthController.loginUser,
);

router.get("/me", auth(), AuthController.getMe);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
	"/change-password",
	auth(),
	validateRequest(AuthValidation.ChangePasswordZodSchema),
	AuthController.changePassword,
);

router.post("/logout", auth(), AuthController.logout);

router.post(
	"/upload-avatar",
	auth(),
	upload.single("avatar"),
	AuthController.uploadAvatar,
);

export const AuthRoutes = router;
