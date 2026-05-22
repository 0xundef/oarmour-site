import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth-options"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

const ALLOWED_ROLES = new Set(["USER", "ADMIN"])

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    const actor = session?.user
    if (!actor || actor.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as {
      role?: string
      disabled?: boolean
    } | null

    const hasRole = typeof body?.role === "string"
    const hasDisabled = typeof body?.disabled === "boolean"
    if (!hasRole && !hasDisabled) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    }

    const data: { role?: "USER" | "ADMIN"; disabled?: boolean } = {}

    if (hasRole) {
      const role = body!.role!.trim().toUpperCase()
      if (!ALLOWED_ROLES.has(role)) {
        return NextResponse.json({ error: "Role must be USER or ADMIN." }, { status: 400 })
      }
      if (actor.id === id && role !== "ADMIN") {
        return NextResponse.json(
          { error: "You cannot remove your own admin role." },
          { status: 400 },
        )
      }
      data.role = role as "USER" | "ADMIN"
    }

    if (hasDisabled) {
      if (actor.id === id && body!.disabled) {
        return NextResponse.json(
          { error: "You cannot disable your own account." },
          { status: 400 },
        )
      }
      data.disabled = body!.disabled
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, disabled: true },
    })

    return NextResponse.json({ ok: true, user: updated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e ?? "")
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
