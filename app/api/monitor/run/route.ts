import { NextResponse } from 'next/server'
import { monitorExtensionsOnce } from '@/lib/monitor/extensions-monitor'

export const runtime = 'nodejs'

export async function GET() {
  const result = await monitorExtensionsOnce()
  return NextResponse.json(result)
}

export async function POST() {
  const result = await monitorExtensionsOnce()
  return NextResponse.json(result)
}
