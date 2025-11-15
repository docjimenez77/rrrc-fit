// app/api/upc/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

/**
 * Prisma client setup using globalThis to avoid multiple instances in dev.
 */
const _global = (globalThis as unknown) as { __prisma?: PrismaClient }
const prisma: PrismaClient = _global.__prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  _global.__prisma = prisma
}

/**
 * GET /api/upc?upc=012345678901
 *
 * Returns:
 * 200 { ok: true, upc, description, size, width, ... }
 * 400 { ok: false, error: 'missing upc' }
 * 404 { ok: false, error: 'not found' }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const upc = (url.searchParams.get('upc') || '').replace(/\D/g, '')
    if (!upc) {
      return NextResponse.json({ ok: false, error: 'missing upc query param' }, { status: 400 })
    }

    const rec = await prisma.productUPC.findUnique({
      where: { upc },
      select: {
        upc: true,
        description: true,
        size: true,
        width: true,
        modelName: true,
        brand: true,
      },
    })

    if (!rec) {
      return NextResponse.json({ ok: false, error: 'not found', upc }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...rec })
  } catch (err: any) {
    console.error('UPC lookup error:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
