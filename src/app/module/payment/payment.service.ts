import httpStatus from "http-status";
import Stripe from "stripe";
import config from "../../config";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog } from "../../utils/auditLog";
import type {
	IPaymentCreatePayload,
	IPaymentQueryParams,
} from "./payment.interface";

const toNumber = (value: unknown): number => {
	if (typeof value === "object" && value !== null && "toString" in value) {
		return Number(value.toString());
	}
	return Number(value);
};

const formatPayment = (payment: any) => ({
	...payment,
	amount: toNumber(payment.amount),
});

const createCheckoutSession = async (
	payload: IPaymentCreatePayload,
	user: IRequestUser,
) => {
	const { payrollId, currency = "usd" } = payload;

	const payroll = await prisma.payroll.findFirst({
		where: {
			id: payrollId,
			organizationId: user.organizationId,
		},
		include: {
			employee: {
				include: { user: { omit: { password: true } } },
			},
		},
	});

	if (!payroll) {
		throw new AppError(httpStatus.NOT_FOUND, "Payroll not found");
	}

	if (payroll.status !== "APPROVED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Can only create payment for approved payroll",
		);
	}

	const existingPayment = await prisma.payment.findUnique({
		where: { payrollId },
	});

	if (existingPayment) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Payment already exists for this payroll",
		);
	}

	const appUrl = config.app_url;

	const session = await stripe.checkout.sessions.create({
		payment_method_types: ["card"],
		mode: "payment",
		success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${appUrl}/payment/cancel`,
		customer_email: payroll.employee.user.email,
		metadata: {
			payrollId: payroll.id,
			employeeId: payroll.employeeId,
			organizationId: payroll.organizationId,
		},
		line_items: [
			{
				price_data: {
					currency,
					product_data: {
						name: `Salary for ${payroll.employee.user.name}`,
						description: `Payroll: ${new Date(payroll.periodStart).toLocaleDateString()} - ${new Date(payroll.periodEnd).toLocaleDateString()}`,
					},
					unit_amount: Math.round(Number(payroll.netAmount) * 100),
				},
				quantity: 1,
			},
		],
	});

	const payment = await prisma.payment.create({
		data: {
			payrollId,
			employeeId: payroll.employeeId,
			organizationId: user.organizationId,
			amount: payroll.netAmount,
			currency,
			gateway: "STRIPE",
			transactionId: session.id,
			status: "PROCESSING",
		},
		include: {
			employee: {
				include: { user: { omit: { password: true } } },
			},
			payroll: true,
		},
	});

	createAuditLog({
		user,
		action: AuditAction.PAYMENT_INITIATED,
		entity: "Payment",
		entityId: payment.id,
		metadata: { payrollId, amount: payroll.netAmount, currency },
	});

	return {
		checkoutUrl: session.url,
		payment,
	};
};

const handleWebhook = async (rawBody: string | Buffer, signature: string) => {
	const webhookSecret = config.stripe_webhook_secret;
	if (!webhookSecret) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"STRIPE_WEBHOOK_SECRET is missing",
		);
	}

	let event: import("stripe").Stripe.Event;

	try {
		event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
	} catch (err: any) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Webhook Signature verification failed: ${err.message}`,
		);
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;

		const payrollId = session.metadata?.payrollId;
		if (!payrollId) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Missing payroll ID in metadata",
			);
		}

		const payment = await prisma.payment.findUnique({
			where: { payrollId },
		});

		if (!payment) {
			throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
		}

		// Idempotency check - skip if already completed
		if (payment.status === "COMPLETED") {
			return { received: true };
		}

		await prisma.$transaction([
			prisma.payment.update({
				where: { id: payment.id },
				data: {
					status: "COMPLETED",
					transactionId: session.payment_intent as string,
				},
			}),
			prisma.payroll.update({
				where: { id: payrollId },
				data: { status: "PAID" },
			}),
		]);
	}

	if (event.type === "checkout.session.async_payment_failed") {
		const session = event.data.object as Stripe.Checkout.Session;

		const payrollId = session.metadata?.payrollId;
		if (!payrollId) return { received: true };

		const payment = await prisma.payment.findUnique({
			where: { payrollId },
		});

		if (!payment) return { received: true };

		// Idempotency check - skip if already failed or completed
		if (payment.status === "FAILED" || payment.status === "COMPLETED") {
			return { received: true };
		}

		await prisma.payment.update({
			where: { id: payment.id },
			data: { status: "FAILED" },
		});
	}

	if (event.type === "payment_intent.payment_failed") {
		const paymentIntent = event.data.object as Stripe.PaymentIntent;

		const payment = await prisma.payment.findFirst({
			where: { transactionId: paymentIntent.id },
		});

		if (payment && payment.status !== "FAILED" && payment.status !== "COMPLETED") {
			await prisma.payment.update({
				where: { id: payment.id },
				data: { status: "FAILED" },
			});
		}
	}

	return { received: true };
};

const getAllPayments = async (
	user: IRequestUser,
	query: IPaymentQueryParams,
) => {
	const page = Number(query.page) || 1;
	const limit = Number(query.limit) || 10;
	const { status, employeeId } = query;

	const where: Record<string, unknown> = {
		organizationId: user.organizationId,
	};

	if (status) {
		where.status = status;
	}

	if (employeeId) {
		where.employeeId = employeeId;
	}

	const skip = (page - 1) * limit;

	const [payments, total] = await Promise.all([
		prisma.payment.findMany({
			where,
			include: {
				employee: {
					include: { user: { omit: { password: true } } },
				},
				payroll: true,
			},
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.payment.count({ where }),
	]);

	return {
		payments: payments.map(formatPayment),
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
};

const getPaymentById = async (id: string, user: IRequestUser) => {
	const payment = await prisma.payment.findFirst({
		where: {
			id,
			organizationId: user.organizationId,
		},
		include: {
			employee: {
				include: { user: { omit: { password: true } } },
			},
			payroll: true,
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	return formatPayment(payment);
};

const getMyPayments = async (user: IRequestUser) => {
	const employee = await prisma.employee.findUnique({
		where: { userId: user.userId },
	});

	if (!employee) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"This endpoint is for employees only",
		);
	}

	const payments = await prisma.payment.findMany({
		where: { employeeId: employee.id },
		include: {
			payroll: true,
		},
		orderBy: { createdAt: "desc" },
	});

	return payments.map(formatPayment);
};

export const PaymentService = {
	createCheckoutSession,
	handleWebhook,
	getAllPayments,
	getPaymentById,
	getMyPayments,
};
