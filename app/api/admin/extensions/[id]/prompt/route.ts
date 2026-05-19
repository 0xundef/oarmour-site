import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { resolveExtensionPromptMarkdown } from '@/lib/extension-prompt'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const extension = await prisma.globalExtension.findUnique({
      where: { id },
      select: { storeId: true, promptMarkdown: true },
    })
    if (!extension) {
      return NextResponse.json({ error: 'Extension not found' }, { status: 404 })
    }

    const promptMarkdown = resolveExtensionPromptMarkdown(
      extension.storeId,
      extension.promptMarkdown,
    )
    return NextResponse.json({ promptMarkdown })
  } catch {
    return NextResponse.json({ error: 'Failed to load prompt' }, { status: 500 })
  }
}
