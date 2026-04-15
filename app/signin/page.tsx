import { Metadata } from "next";
import Link from "next/link";
import UserAuthForm from "@/components/forms/user-auth-form";
import Logo from "@/components/logo";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Authentication forms built using the components.",
};

export default function AuthenticationPage() {
  return (
    <div className="relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-1 lg:px-0 bg-muted/30">
      <div className="p-4 lg:p-8 h-full flex items-center">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] bg-background p-8 rounded-xl border shadow-sm">
          <div className="flex flex-col space-y-2 text-center items-center">
            <div className="mb-2">
              <Logo />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to OArmour
            </h1>
            <p className="text-sm text-muted-foreground">
              Unlock all features by logging in
            </p>
          </div>
          <UserAuthForm />
          <p className="px-8 text-center text-xs text-muted-foreground">
            By logging in, you agree to our{" "}
            <Link
              href="/terms"
              className="underline underline-offset-4 hover:text-primary"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-primary"
            >
              Privacy Policy
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-4">
             copyright © 2025 Powered by Open WebUI
          </p>
        </div>
      </div>
    </div>
  );
}
