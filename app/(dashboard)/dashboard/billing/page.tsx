import { getCurrentUser } from "@/lib/session"
import { redirect } from "next/navigation"
import { SubscriptionButton, ManageSubscriptionButton } from "@/components/billing/subscription-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { Check } from "lucide-react"

export default async function BillingPage() {
  const session = await getCurrentUser()

  if (!session) {
    redirect("/signin")
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.id,
    },
  })

  if (!user) {
    redirect("/signin")
  }

  const isSubscribed = !!user.stripeSubscriptionId

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
      </div>
      
      {isSubscribed ? (
         <Card className="max-w-md">
            <CardHeader>
                <CardTitle>Current Subscription</CardTitle>
                <CardDescription>
                    You are currently subscribed to a plan.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Your subscription is active. You can manage your billing details and subscription status.
                </p>
                <ManageSubscriptionButton />
            </CardContent>
         </Card>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Starter Plan */}
            <Card className="flex flex-col border-primary shadow-md relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">
                    POPULAR
                </div>
                <CardHeader>
                    <CardTitle>Starter Plan</CardTitle>
                    <CardDescription>Secure your computer</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="text-3xl font-bold mb-4">$10<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Limited Extension Submission</li>
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Unlimited Analysis Results</li>
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Max 2 Alert Subscriptions</li>
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> No API Integration</li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <SubscriptionButton 
                        userId={user.id} 
                        email={user.email} 
                        paymentLink="https://buy.stripe.com/aFa14odpK4J50dB1cGdnW02"
                        text="Subscribe to Starter"
                    />
                </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle>Pro Plan</CardTitle>
                    <CardDescription>More enhanced features</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="text-3xl font-bold mb-4">$30<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                     <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Unlimited Extension Submission</li>
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Unlimited Analysis Results</li>
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Max 10 Alert Subscriptions</li>
                        <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> API Integration</li>
                    </ul>
                </CardContent>
                <CardFooter>
                    <SubscriptionButton 
                        userId={user.id} 
                        email={user.email} 
                        paymentLink="https://buy.stripe.com/7sYfZidpKb7t2lJg7AdnW03"
                        text="Subscribe to Pro"
                    />
                </CardFooter>
            </Card>
        </div>
      )}
    </div>
  )
}
