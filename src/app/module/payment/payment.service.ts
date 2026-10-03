import httpStatus from "http-status";
import type Stripe from "stripe";
import config from "../../config";
import type { IRequestUser } from "../../interfaces";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { AppError } from "../../utils/AppError";
import { AuditAction, createAuditLog, toAuditValue } from "../../utils/auditLog";
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

	const [payroll, existingPayment] = await Promise.all([
		prisma.payroll.findFirst({
			where: {
				id: payrollId,
				organizationId: user.organizationId,
			},
			include: {
				employee: {
					include: { user: { omit: { password: true } } },
				},
			},
		}),
		prisma.payment.findUnique({ where: { payrollId } }),
	]);

	if (!payroll) {
		throw new AppError(httpStatus.NOT_FOUND, "Payroll not found");
	}

	if (payroll.status !== "APPROVED") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Can only create payment for approved payroll",
		);
	}

	if (existingPayment?.status === "COMPLETED") {
		throw new AppError(
			httpStatus.CONFLICT,
			"This payroll has already been paid",
		);
	}

	// Retry: close the old checkout so it can't also be paid — in the background, so it doesn't delay the new one
	if (existingPayment?.transactionId?.startsWith("cs_")) {
		stripe.checkout.sessions.expire(existingPayment.transactionId).catch(() => {
			// already completed/expired sessions can't be expired — nothing to do
		});
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
		payment_intent_data: {
			metadata: { payrollId: payroll.id, organizationId: payroll.organizationId },
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

	const payment = await prisma.payment.upsert({
		where: { payrollId },
		create: {
			payrollId,
			employeeId: payroll.employeeId,
			organizationId: user.organizationId,
			amount: payroll.netAmount,
			currency,
			gateway: "STRIPE",
			transactionId: session.id,
			status: "PROCESSING",
		},
		update: {
			amount: payroll.netAmount,
			currency,
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
		metadata: {
			employeeName: payroll.employee.user.name,
			periodStart: toAuditValue(payroll.periodStart),
			periodEnd: toAuditValue(payroll.periodEnd),
			amount: toAuditValue(payroll.netAmount),
			currency,
		},
	});

	return {
		checkoutUrl: session.url,
		payment,
	};
};

// Shared by webhook + verify; returns false if already completed, so calling twice is safe
// Webhooks have no logged-in user, so their events are attributed to whoever started the payment
const logPaymentEvent = async (
	payment: { id: string; organizationId: string },
	action: typeof AuditAction.PAYMENT_COMPLETED | typeof AuditAction.PAYMENT_FAILED,
	metadata: Record<string, unknown>,
	actor?: IRequestUser,
) => {
	const userId =
		actor?.userId ??
		(
			await prisma.auditLog.findFirst({
				where: {
					entity: "Payment",
					entityId: payment.id,
					action: AuditAction.PAYMENT_INITIATED,
				},
				orderBy: { createdAt: "desc" },
				select: { userId: true },
			})
		)?.userId;

	if (!userId) return;

	const details = await prisma.payment.findUnique({
		where: { id: payment.id },
		select: {
			amount: true,
			currency: true,
			employee: { select: { user: { select: { name: true } } } },
			payroll: { select: { periodStart: true, periodEnd: true } },
		},
	});

	createAuditLog({
		user: { userId, organizationId: payment.organizationId },
		action,
		entity: "Payment",
		entityId: payment.id,
		metadata: {
			employeeName: details?.employee.user.name ?? null,
			periodStart: toAuditValue(details?.payroll.periodStart),
			periodEnd: toAuditValue(details?.payroll.periodEnd),
			amount: toAuditValue(details?.amount),
			currency: details?.currency ?? null,
			...metadata,
		},
	});
};

const completePayment = async (
	payrollId: string,
	paymentIntentId: string,
	source: "webhook" | "verify",
	actor?: IRequestUser,
) => {
	const payment = await prisma.payment.findUnique({
		where: { payrollId },
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	if (payment.status === "COMPLETED") {
		return false;
	}

	await prisma.$transaction([
		prisma.payment.update({
			where: { id: payment.id },
			data: { status: "COMPLETED", transactionId: paymentIntentId },
		}),
		prisma.payroll.update({
			where: { id: payrollId },
			data: { status: "PAID" },
		}),
	]);

	await logPaymentEvent(
		payment,
		AuditAction.PAYMENT_COMPLETED,
		{ transactionId: paymentIntentId, source },
		actor,
	);
	return true;
};

// Success page asks Stripe directly, so payments complete even if the webhook can't reach us
const verifyCheckoutSession = async (sessionId: string, user: IRequestUser) => {
	let session: Stripe.Checkout.Session;
	try {
		session = await stripe.checkout.sessions.retrieve(sessionId);
	} catch {
		throw new AppError(httpStatus.NOT_FOUND, "Checkout session not found");
	}

	const payrollId = session.metadata?.payrollId;
	if (!payrollId || session.metadata?.organizationId !== user.organizationId) {
		throw new AppError(httpStatus.NOT_FOUND, "Checkout session not found");
	}

	const isPaid = session.payment_status === "paid";
	if (isPaid) {
		await completePayment(payrollId, session.payment_intent as string, "verify", user);
	}

	const payment = await prisma.payment.findUnique({
		where: { payrollId },
		include: {
			employee: { include: { user: { omit: { password: true } } } },
			payroll: true,
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
	}

	return {
		status: isPaid ? "paid" : session.status === "expired" ? "expired" : "unpaid",
		payment: {
			...formatPayment(payment),
			payroll: {
				...payment.payroll,
				grossAmount: toNumber(payment.payroll.grossAmount),
				deductions: toNumber(payment.payroll.deductions),
				netAmount: toNumber(payment.payroll.netAmount),
			},
		},
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

		await completePayment(payrollId, session.payment_intent as string, "webhook");
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
		await logPaymentEvent(payment, AuditAction.PAYMENT_FAILED, {
			reason: "async payment failed",
			source: "webhook",
		});
	}

	if (event.type === "payment_intent.payment_failed") {
		const paymentIntent = event.data.object as Stripe.PaymentIntent;

		// Until completion the record holds the checkout session id, so find it via metadata
		const payrollId = paymentIntent.metadata?.payrollId;
		const payment = payrollId
			? await prisma.payment.findUnique({ where: { payrollId } })
			: await prisma.payment.findFirst({ where: { transactionId: paymentIntent.id } });

		if (
			payment &&
			payment.status !== "FAILED" &&
			payment.status !== "COMPLETED"
		) {
			await prisma.payment.update({
				where: { id: payment.id },
				data: { status: "FAILED" },
			});
			await logPaymentEvent(payment, AuditAction.PAYMENT_FAILED, {
				reason: paymentIntent.last_payment_error?.message ?? "payment failed",
				source: "webhook",
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
	verifyCheckoutSession,
	handleWebhook,
	getAllPayments,
	getPaymentById,
	getMyPayments,
};
