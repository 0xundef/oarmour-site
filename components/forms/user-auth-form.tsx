"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleSignInButton from "../google-auth-button";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function UserAuthForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const registered = searchParams.get("registered");
    const registerError = searchParams.get("register_error");
    if (registered === "1") {
      setInfo("Email verified. Your account is now active. Please sign in.");
      setMode("login");
    } else if (registerError) {
      setError("Verification link is invalid or expired. Please request a new one.");
    }
  }, [searchParams]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInfo("");
    setLoading(true);
    try {
      if (!email.trim() || !password) {
        setError("Email and password are required");
        return;
      }

      if (mode === "register") {
        const resp = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || undefined,
            email: email.trim(),
            password,
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          setError(typeof data?.error === "string" ? data.error : "Registration failed");
          return;
        }
        setInfo(
          typeof data?.message === "string"
            ? data.message
            : "Verification email sent. Please check your inbox and click the link to activate your account.",
        );
        setMode("login");
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("Invalid email or password");
        return;
      }
      window.location.href = result?.url ?? callbackUrl;
    } catch {
      setError("Operation failed, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <GoogleSignInButton />
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          {mode === "register" ? (
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={loading}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>
          {mode === "register" ? (
            <p className="text-xs text-muted-foreground">
              We will send a time-limited verification link to your email before account activation.
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading}
            />
          </div>
          {info ? <p className="text-sm text-emerald-600">{info}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button variant="outline" className="w-full" type="submit" disabled={loading}>
            {loading ? "Processing..." : mode === "login" ? "Continue with Email" : "Send verification email"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            type="button"
            disabled={loading}
            onClick={() => {
              setError("");
              setInfo("");
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login" ? "No account? Register" : "Already have an account? Login"}
          </Button>
        </form>

        <Button variant="outline" className="w-full">
          Skip for now
        </Button>
      </div>
    </>
  );
}
