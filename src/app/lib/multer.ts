import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
	storage,
	limits: {
		fileSize: 10 * 1024 * 1024, // 5MB
	},
	fileFilter: (_req, file, cb) => {
		const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
		if (allowedMimes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
		}
	},
});
