// app/fit/sessions/page.tsx
import fs from 'fs'
import path from 'path'
import React from 'react'

export const runtime = 'nodejs'

type Session = {
  id: string
  employeeId?: string
  customer?: any
  shoes?: any[]
  createdAt?: string
}

function readSessions(): Session[] {
  try {
    const file = path.join(process.cwd(), 'data', 'fit-sessions.json')
    if (!fs.existsSync(file)) return []
    const txt = fs.readFileSync(file, 'utf8').trim()
    if (!txt) return []
    const arr = JSON.parse(txt)
    if (!Array.isArray(arr)) return []
    // show newest first
    return arr.slice().reverse()
  } catch (err) {
    console.error('readSessions error', err)
    return []
  }
}

export default function Page() {
  const sessions = readSessions()

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Saved Fit Sessions ({sessions.length})</h1>

      {sessions.length === 0 ? (
        <div className="text-sm text-gray-600">No sessions saved yet.</div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="border rounded p-4 bg-white shadow">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-gray-500">ID: {s.id}</div>
                  <div className="font-medium">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</div>
                </div>
                <div className="text-sm text-gray-600">Employee: {s.employeeId || '—'}</div>
              </div>

              <div className="mt-3 text-sm text-gray-700">
                <div>
                  <strong>Customer:</strong>{' '}
                  {s.customer
                    ? s.customer.type === 'existing'
                      ? `${s.customer.firstName} ${s.customer.lastName} (existing)`
                      : `${s.customer.firstName || ''} ${s.customer.lastName || ''} (new)`
                    : '—'}
                </div>
                {s.customer && (
                  <div className="mt-1">
                    <div>Phone: {s.customer.phone || '—'}</div>
                    <div>Email: {s.customer.email || '—'}</div>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <strong>Shoes</strong>
                <ul className="list-disc pl-5 mt-2 text-sm text-gray-700">
                  {(s.shoes || []).map((sh: any) => (
                    <li key={sh.id} className="mb-1">
                      <div>
                        <span className="font-medium">{sh.model || '—'}</span> — size: {sh.size || '—'} — width:{' '}
                        {sh.width || '—'} — rating: {sh.rating ?? '—'}
                      </div>
                      {sh.notes ? <div className="text-xs text-gray-500">Notes: {sh.notes}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
