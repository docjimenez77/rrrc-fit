// app/api/fit-sessions/route.ts
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

export async function POST(req: Request) {
  try {
    const payload = await req.json()

    // Basic validation
    const employeeId = payload?.employeeId
    if (!employeeId) {
      return NextResponse.json({ ok: false, error: 'employeeId required' }, { status: 400 })
    }

    // Ensure employee exists (upsert by id)
    const employee = await prisma.employee.upsert({
      where: { id: String(employeeId) },
      update: {},
      create: { id: String(employeeId), name: String(employeeId) },
    })

    // Handle customer (existing or new)
    let customerId: string | null = null
    if (payload?.customer) {
      const cust = payload.customer
      if (cust.type === 'existing' && cust.id) {
        // Upsert by provided id
        const up = await prisma.customer.upsert({
          where: { id: String(cust.id) },
          update: {
            firstName: cust.firstName ?? undefined,
            lastName: cust.lastName ?? undefined,
            phone: cust.phone ?? undefined,
            email: cust.email ?? undefined,
          },
          create: {
            id: String(cust.id),
            firstName: cust.firstName ?? '',
            lastName: cust.lastName ?? '',
            phone: cust.phone ?? '',
            email: cust.email ?? '',
          },
        })
        customerId = up.id
      } else if (cust.type === 'new') {
        const createdCust = await prisma.customer.create({
          data: {
            firstName: cust.firstName ?? '',
            lastName: cust.lastName ?? '',
            phone: cust.phone ?? '',
            email: cust.email ?? '',
          },
        })
        customerId = createdCust.id
      }
    }

    // Create the fit session with nested shoes
    const created = await prisma.fitSession.create({
      data: {
        employeeId: employee.id,
        customerId: customerId ?? undefined,
        notes: payload?.notes ?? undefined,
        shoes: {
          create: (payload.shoes || []).map((sh: any) => ({
            modelName: sh.model ?? '',
            size: sh.size ?? '',
            width: sh.width ?? '',
            rating: Number(sh.rating ?? 0),
            notes: sh.notes ?? '',
          })),
        },
      },
      include: { shoes: true },
    })

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (err: any) {
    console.error('Prisma save error:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
