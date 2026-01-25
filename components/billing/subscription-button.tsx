"use client"

import { Button } from "@/components/ui/button"

interface SubscriptionButtonProps {
  userId: string
  email: string | null
  paymentLink: string
  text?: string
}

export function SubscriptionButton({ userId, email, paymentLink, text = "Subscribe" }: SubscriptionButtonProps) {
  const handleSubscribe = () => {
    const url = new URL(paymentLink)
    url.searchParams.set("client_reference_id", userId)
    if (email) {
      url.searchParams.set("prefilled_email", email)
    }
    window.location.href = url.toString()
  }

  return (
    <Button onClick={handleSubscribe} className="w-full">
      {text}
    </Button>
  )
}

export function ManageSubscriptionButton() {
  const handleManage = () => {
     // Ideally this should redirect to Stripe Customer Portal
     alert("To manage your subscription, please contact support or use the Stripe Customer Portal if configured.")
  }

  return (
      <Button onClick={handleManage} variant="outline" className="w-full">
          Manage Subscription
      </Button>
  )
}
