import ejs from "ejs";
import path from "path";
import { transporter } from "../lib/nodemailer";

interface ISendEmployeeWelcomeEmail {
	to: string;
	name: string;
	email: string;
	temporaryPassword: string;
	roleName: string;
	organizationName: string;
}

export const sendEmployeeWelcomeEmail = async (
	payload: ISendEmployeeWelcomeEmail,
) => {
	const templatePath = path.join(
		process.cwd(),
		"src",
		"app",
		"templates",
		"employee-welcome-email.ejs",
	);

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
