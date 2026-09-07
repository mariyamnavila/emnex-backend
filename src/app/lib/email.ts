import fs from "node:fs";
import path from "node:path";
import ejs from "ejs";
import config from "../config";
import { transporter } from "../lib/nodemailer";

interface ISendEmployeeWelcomeEmail {
	to: string;
	name: string;
	email: string;
	temporaryPassword: string;
	roleName: string;
	organizationName: string;
}

const getTemplatePath = (): string => {
	const possiblePaths = [
		path.join(
			process.cwd(),
			"src",
			"app",
			"templates",
			"employee-welcome-email.ejs",
		),
		path.join(
			process.cwd(),
			"dist",
			"app",
			"templates",
			"employee-welcome-email.ejs",
		),
		path.join(process.cwd(), "app", "templates", "employee-welcome-email.ejs"),
		path.resolve("src/app/templates/employee-welcome-email.ejs"),
	];

	for (const p of possiblePaths) {
		if (fs.existsSync(p)) {
			return p;
		}
	}

	return possiblePaths[0];
};

export const sendEmployeeWelcomeEmail = async (
	payload: ISendEmployeeWelcomeEmail,
) => {
	const senderEmail = config.smtp_user;

	if (!senderEmail || !config.smtp_password) {
		console.warn(
			"SMTP configuration missing (SMTP_USER / SMTP_PASSWORD). Skipping email dispatch.",
		);
		return;
	}

	const templatePath = getTemplatePath();

	const html = await ejs.renderFile(templatePath, {
		name: payload.name,
		email: payload.email,
		temporaryPassword: payload.temporaryPassword,
		roleName: payload.roleName,
		organizationName: payload.organizationName,
	});

	await transporter.sendMail({
		from: '"EmNex" <noreply@emnex.com>',
		to: payload.to,
		subject: `Welcome to ${payload.organizationName} - Your EmNex Account`,
		html,
	});
};
