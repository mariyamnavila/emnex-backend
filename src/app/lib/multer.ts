import httpStatus from "http-status";
import multer from "multer";
import { AppError } from "../utils/AppError";

const storage = multer.memoryStorage();

export const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5 MB, same as the profile page
	},
	fileFilter: (_req, file, cb) => {
		const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
		if (allowedMimes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(
				new AppError(
					httpStatus.BAD_REQUEST,
					"Only JPEG, PNG, and WebP images are allowed",
				),
			);
		}
	},
});
