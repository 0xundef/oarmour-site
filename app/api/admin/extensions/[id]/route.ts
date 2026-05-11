import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Extension name is required" }, { status: 400 });
    }

    const extension = await prisma.globalExtension.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });

    return NextResponse.json({ ok: true, extension });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    try {
      await prisma.extensionAnalysisResult.deleteMany({ where: { extensionId: id } });
      await prisma.domainEnrichment.deleteMany({
        where: { analysis: { extensionId: id } } as any,
      });
    } catch {}
    try {
      await prisma.globalExtension.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("Foreign key constraint") || msg.includes("constraint")) {
        return NextResponse.json(
          { error: "Delete blocked by related records" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
