import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_API_KEY || "sk_test_mock_key", {
  apiVersion: "2024-12-18.acacia" as any,
  typescript: true,
})
