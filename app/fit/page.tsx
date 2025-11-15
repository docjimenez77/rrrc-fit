'use client'

import React, { useState } from 'react'
import ScanAndAddShoe from 'components/ScanAndAddShoe'
import { v4 as uuidv4 } from 'uuid'

type ShoeTried = {
  id: string
  model: string
  size: string
  width: string
  rating: number // 1..4 (color code)
  notes: string
}

type Employee = { id: string; name: string }
type Customer = { id: string; firstName: string; lastName: string; phone: string; email: string }

const SAMPLE_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Alex' },
  { id: 'e2', name: 'Sam' },
  { id: 'e3', name: 'Taylor' },
]

const SAMPLE_CUSTOMERS: Customer[] = [
  { id: 'c1', firstName: 'Jamie', lastName: 'Parker', phone: '555-1010', email: 'jamie@example.com' },
  { id: 'c2', firstName: 'Jordan', lastName: 'Reed', phone: '555-2020', email: 'jordan@example.com' },
  { id: 'c3', firstName: 'Casey', lastName: 'Dawson', phone: '555-3030', email: 'casey@example.com' },
]

function ratingClasses(r: number) {
  switch (r) {
    case 1:
      return 'bg-red-100 text-red-800'
    case 2:
      return 'bg-amber-100 text-amber-800'
    case 3:
      return 'bg-emerald-100 text-emerald-800'
    case 4:
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export default function FitPage() {
  const [employeeId, setEmployeeId] = useState<string>(SAMPLE_EMPLOYEES[0].id)
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | ''>(SAMPLE_CUSTOMERS[0].id)
  const [customerQuery, setCustomerQuery] = useState<string>('')
  const [newCustomer, setNewCustomer] = useState<{
    firstName: string
    lastName: string
    phone: string
    email: string
  }>({ firstName: '', lastName: '', phone: '', email: '' })

  const [shoes, setShoes] = useState<ShoeTried[]>([
    { id: uuidv4(), model: '', size: '', width: 'D', rating: 3, notes: '' },
  ])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  function addShoe() {
    setShoes((s) => [...s, { id: uuidv4(), model: '', size: '', width: 'D', rating: 3, notes: '' }])
  }

  function removeShoe(id: string) {
    setShoes((s) => s.filter((sh) => sh.id !== id))
  }

  function updateShoe(id: string, patch: Partial<ShoeTried>) {
    setShoes((list) => list.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)))
  }

  const filteredCustomers = SAMPLE_CUSTOMERS.filter((c) => {
    const hay = `${c.firstName} ${c.lastName} ${c.phone} ${c.email}`.toLowerCase()
    return hay.includes(customerQuery.trim().toLowerCase())
  })

  async function saveSession() {
    if (!employeeId) {
      setStatusMessage('Please pick an employee.')
      return
    }

    let customerPayload:
      | { type: 'existing'; id: string; firstName: string; lastName: string; phone: string; email: string }
      | { type: 'new'; firstName: string; lastName: string; phone: string; email: string }

    if (customerMode === 'existing') {
      const found = SAMPLE_CUSTOMERS.find((c) => c.id === selectedCustomerId)
      if (!found) {
        setStatusMessage('Please select an existing customer.')
        return
      }
      customerPayload = {
        type: 'existing',
        id: found.id,
        firstName: found.firstName,
        lastName: found.lastName,
        phone: found.phone,
        email: found.email,
      }
    } else {
      customerPayload = {
        type: 'new',
        firstName: newCustomer.firstName || 'Unnamed',
        lastName: newCustomer.lastName || '',
        phone: newCustomer.phone || '',
        email: newCustomer.email || '',
      }
    }

    const payload = {
      employeeId,
      customer: customerPayload,
      shoes,
      createdAt: new Date().toISOString(),
    }

    try {
      const res = await fetch('/api/fit-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text()
        console.error('Save failed:', txt)
        setStatusMessage('Save failed — check console.')
        return
      }
      const data = await res.json()
      setStatusMessage('Saved (id: ' + (data.id || 'unknown') + ')')
      // clear after a moment
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error('Save exception:', err)
      setStatusMessage('Save error — check console.')
    }
  }


  function resetForm() {
    setShoes([{ id: uuidv4(), model: '', size: '', width: 'D', rating: 3, notes: '' }])
    setNewCustomer({ firstName: '', lastName: '', phone: '', email: '' })
    setSelectedCustomerId(SAMPLE_CUSTOMERS[0].id)
    setCustomerQuery('')
    setStatusMessage('Cleared for a new session.')
    setTimeout(() => setStatusMessage(null), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Fit Session</h1>

      <section className="bg-white shadow rounded p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="w-full max-w-sm border rounded px-3 py-2"
        >
          {SAMPLE_EMPLOYEES.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </section>

      <section className="bg-white shadow rounded p-4 mb-4">
        <div className="flex items-center gap-4 mb-3">
          <label className="text-sm font-medium text-gray-700">Customer</label>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="customerMode"
                checked={customerMode === 'existing'}
                onChange={() => setCustomerMode('existing')}
                className="mr-1"
              />
              Existing
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="customerMode"
                checked={customerMode === 'new'}
                onChange={() => setCustomerMode('new')}
                className="mr-1"
              />
              New
            </label>
          </div>
        </div>

        {customerMode === 'existing' ? (
          <>
            <div className="mb-3">
              <input
                placeholder="Lookup by first, last, phone, or email"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className="w-full max-w-md border rounded px-3 py-2"
              />
            </div>

            <div className="mb-3">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full max-w-md border rounded px-3 py-2"
              >
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} — {c.phone} — {c.email}
                    </option>
                  ))
                ) : (
                  <option value="">No matches</option>
                )}
              </select>
            </div>

            {selectedCustomerId ? (
              (() => {
                const c = SAMPLE_CUSTOMERS.find((x) => x.id === selectedCustomerId)
                if (!c) return null
                return (
                  <div className="text-sm text-gray-700">
                    <div>
                      <strong>Selected:</strong> {c.firstName} {c.lastName}
                    </div>
                    <div>Phone: {c.phone}</div>
                    <div>Email: {c.email}</div>
                  </div>
                )
              })()
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600">First name</label>
              <input
                value={newCustomer.firstName}
                onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                className="w-full border rounded px-2 py-1"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Last name</label>
              <input
                value={newCustomer.lastName}
                onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                className="w-full border rounded px-2 py-1"
                placeholder="Last name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Phone</label>
              <input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full border rounded px-2 py-1"
                placeholder="555-555-5555"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Email</label>
              <input
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full border rounded px-2 py-1"
                placeholder="name@example.com"
              />
            </div>
          </div>
        )}
      </section>

      <section className="bg-white shadow rounded p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Shoes Tried</h2>
          <button
            onClick={addShoe}
            className="bg-sky-600 text-white px-3 py-1 rounded hover:bg-sky-700"
            aria-label="Add shoe"
          >
            + Add Shoe
          </button>
        </div>

        <div className="space-y-4">
          {shoes.map((shoe, idx) => (
            <div key={shoe.id} className="border rounded p-3 grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600">Model</label>
                <input
                  value={shoe.model}
                  onChange={(e) => updateShoe(shoe.id, { model: e.target.value })}
                  className="w-full border rounded px-2 py-1"
                  placeholder="e.g., Nimbus 25"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Size</label>
                <input
                  value={shoe.size}
                  onChange={(e) => updateShoe(shoe.id, { size: e.target.value })}
                  className="w-20 border rounded px-2 py-1"
                  placeholder="10"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Width</label>
                <select
                  value={shoe.width}
                  onChange={(e) => updateShoe(shoe.id, { width: e.target.value })}
                  className="w-24 border rounded px-2 py-1"
                >
                  <option>D</option>
                  <option>2E</option>
                  <option>B</option>
                  <option>C</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600">Rating</label>
                <div className="flex items-center gap-2">
                  <select
                    value={shoe.rating}
                    onChange={(e) => updateShoe(shoe.id, { rating: Number(e.target.value) })}
                    className={`w-28 border rounded px-2 py-1 ${ratingClasses(shoe.rating)}`}
                  >
                    <option value={1}>1 — Poor</option>
                    <option value={2}>2 — OK</option>
                    <option value={3}>3 — Good</option>
                    <option value={4}>4 — Great</option>
                  </select>
                  <button
                    onClick={() => removeShoe(shoe.id)}
                    className="text-sm text-red-600 hover:underline ml-2"
                    aria-label={`Remove shoe ${idx + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="md:col-span-6">
                <label className="block text-xs font-medium text-gray-600">Notes</label>
                <textarea
                  value={shoe.notes}
                  onChange={(e) => updateShoe(shoe.id, { notes: e.target.value })}
                  className="w-full border rounded px-2 py-1 mt-1"
                  rows={2}
                  placeholder="Fit notes, pressure points, insole used, etc."
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={saveSession} className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700">
          Save Session
        </button>
        <button onClick={resetForm} className="bg-gray-100 px-3 py-2 rounded border">
          Reset
        </button>

        {statusMessage && <div className="ml-3 text-sm text-slate-700">{statusMessage}</div>}
      </div>
    </div>
  )
}
