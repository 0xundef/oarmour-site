import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes } from "crypto";
import { sendRegistrationVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";
const REGISTER_TOKEN_TTL_MINUTES = 30;
const REGISTER_IDENTIFIER_PREFIX = "register:";
const userCreateWithPassword = (prisma as unknown as {
  user: {
    create: (args: {
      data: { email: string; name: string | null; password: string; role: "USER" };
    }) => Promise<unknown>;
  };
}).user;

type RegisterPayload = {
  email: string;
  name: string | null;
  passwordHash: string;
  exp: number;
};

function getTokenSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function signTokenBody(payloadB64: string, nonce: string, secret: string) {
  return createHmac("sha256", secret).update(`${payloadB64}.${nonce}`).digest("base64url");
}

function buildBaseUrl(req: NextRequest) {
  return process.env.NEXTAUTH_URL || new URL(req.url).origin;
}

function parseRegisterToken(rawToken: string, secret: string): RegisterPayload | null {
  const [payloadB64, nonce, signature] = String(rawToken || "").split(".");
  if (!payloadB64 || !nonce || !signature) return null;
  const expected = signTokenBody(payloadB64, nonce, secret);
  if (signature !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as RegisterPayload;
    if (!parsed?.email || !parsed?.passwordHash || !parsed?.exp) return null;
    if (parsed.exp <= Date.now()) return null;
    return {
      email: String(parsed.email).trim().toLowerCase(),
      name: parsed.name ? String(parsed.name) : null,
      passwordHash: String(parsed.passwordHash),
      exp: Number(parsed.exp),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const nameRaw = String(body?.name ?? "").trim();
    const name = nameRaw.length > 0 ? nameRaw : null;

    if (!email || !password) {
      return NextResponse.json({ error: "email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
    }
    const secret = getTokenSecret();
    if (!secret) {
      return NextResponse.json({ error: "NEXTAUTH_SECRET is required" }, { status: 500 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "email already exists" }, { status: 409 });
    }
    const identifier = `${REGISTER_IDENTIFIER_PREFIX}${email}`;
    const pending = await prisma.verificationToken.findFirst({
      where: { identifier, expires: { gt: new Date() } },
      select: { expires: true },
    });
    if (pending) {
      return NextResponse.json(
        { error: "A verification email was already sent. Please check your inbox." },
        { status: 429 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + REGISTER_TOKEN_TTL_MINUTES * 60 * 1000);
    const payload: RegisterPayload = {
      email,
      name,
      passwordHash: hashedPassword,
      exp: expiresAt.getTime(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const nonce = randomBytes(24).toString("base64url");
    const signature = signTokenBody(payloadB64, nonce, secret);
    const rawToken = `${payloadB64}.${nonce}.${signature}`;
    const token = hashToken(rawToken);

    await prisma.verificationToken.create({
      data: {
        identifier,
        token,
        expires: expiresAt,
      },
    });

    const verifyUrl = `${buildBaseUrl(req)}/api/auth/register?token=${encodeURIComponent(rawToken)}`;
    const emailResult = await sendRegistrationVerificationEmail(email, {
      verifyUrl,
      expiresMinutes: REGISTER_TOKEN_TTL_MINUTES,
      name: name ?? undefined,
    });
    if (!emailResult.ok) {
      await prisma.verificationToken.deleteMany({ where: { token } });
      return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, message: "Verification email sent. Please verify your email to activate your account." },
      { status: 202 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "register failed", details: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  const redirectUrl = new URL("/signin", req.url);
  if (!token) {
    redirectUrl.searchParams.set("register_error", "missing_token");
    return NextResponse.redirect(redirectUrl);
  }

  const secret = getTokenSecret();
  if (!secret) {
    redirectUrl.searchParams.set("register_error", "server_misconfigured");
    return NextResponse.redirect(redirectUrl);
  }

  const parsed = parseRegisterToken(token, secret);
  if (!parsed) {
    redirectUrl.searchParams.set("register_error", "invalid_or_expired_token");
    return NextResponse.redirect(redirectUrl);
  }

  const identifier = `${REGISTER_IDENTIFIER_PREFIX}${parsed.email}`;
  const tokenHash = hashToken(token);
  const saved = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
    select: { identifier: true, expires: true },
  });
  if (!saved || saved.identifier !== identifier || saved.expires.getTime() <= Date.now()) {
    redirectUrl.searchParams.set("register_error", "invalid_or_expired_token");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
      select: { id: true },
    });
    if (!existing) {
      await userCreateWithPassword.create({
        data: {
          email: parsed.email,
          name: parsed.name,
          password: parsed.passwordHash,
          role: "USER",
        },
      });
    }
    await prisma.verificationToken.deleteMany({
      where: { identifier },
    });
  } catch {
    redirectUrl.searchParams.set("register_error", "verify_failed");
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("registered", "1");
  redirectUrl.searchParams.set("email", parsed.email);
  return NextResponse.redirect(redirectUrl);
}
