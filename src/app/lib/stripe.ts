import Stripe from "stripe";
import config from "../config";

if (!config.stripe_secret_key) {
	console.warn("WARNING: STRIPE_SECRET_KEY is missing from configuration.");
}

export const stripe = new Stripe(config.stripe_secret_key || "");
