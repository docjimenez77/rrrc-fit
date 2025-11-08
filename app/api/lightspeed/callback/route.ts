// app/api/lightspeed/callback/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Exchange the authorization code for tokens (R-Series style: Basic auth),
 * validate the state cookie, write tokens to data/lightspeed-tokens.json (local),
 * and redirect the browser back to /fit with a success flag.
 *
 * NOTE: storing tokens in a file is only for local testing. For production you should
 * persist tokens securely (DB, secrets manager) and rotate them appropriately.
 */

function dataFilePath() {
  return path.join(process.cwd(), 'data', 'lightspeed-tokens.json')
}

function parseCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';').map((p) => p.trim())
  for (const p of parts) {
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1))
  }
  return null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code) {
      return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 })
    }

    // Validate state cookie
    const cookieHeader = req.headers.get('cookie')
    const cookieState = parseCookie(cookieHeader, 'ls_oauth_state')
    if (!state || !cookieState || state !== cookieState) {
      return NextResponse.json({ ok: false, error: 'Invalid or missing state' }, { status: 400 })
    }

    // clear the state cookie
    const clearStateCookie = `ls_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

    // Read envs
    const LS_TOKEN_ENDPOINT = process.env.LS_TOKEN_ENDPOINT
    const LS_API_KEY = process.env.LS_API_KEY
    const LS_API_SECRET = process.env.LS_API_SECRET
    const LS_REDIRECT_URI = process.env.LS_REDIRECT_URI

    if (!LS_TOKEN_ENDPOINT || !LS_API_KEY || !LS_API_SECRET || !LS_REDIRECT_URI) {
      return NextResponse.json({ ok: false, error: 'Lightspeed envs not configured' }, { status: 500 })
    }

    // Prepare token exchange (R-Series expects Basic auth)
    const basic = Buffer.from(`${LS_API_KEY}:${LS_API_SECRET}`).toString('base64')
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: LS_REDIRECT_URI,
    })

    const tokenRes = await fetch(LS_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    })

    const tokenText = await tokenRes.text()
    if (!tokenRes.ok) {
      // return the error (and clear cookie for safety)
      return NextResponse.json({ ok: false, status: tokenRes.status, details: tokenText }, {
        status: 500,
        headers: { 'Set-Cookie': clearStateCookie },
      })
    }

    // Parse the token response (JSON)
    let tokenJson: any = {}
    try {
      tokenJson = JSON.parse(tokenText)
    } catch (e) {
      tokenJson = { raw: tokenText }
    }

    // Persist tokens locally for testing
    const file = dataFilePath()
    const dir = path.dirname(file)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    // We'll store an array of token objects (append)
    let arr: any[] = []
    if (fs.existsSync(file)) {
      try {
        const txt = fs.readFileSync(file, 'utf8').trim()
        if (txt) arr = JSON.parse(txt)
      } catch (e) {
        arr = []
      }
    }

    const record = {
      id: new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      tokenResponse: tokenJson,
    }
    arr.push(record)
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8')

    // Redirect back to the app with success indicator; also clear the ls_oauth_state cookie
    const redirectUrl = '/fit?ls_auth=success'
    return NextResponse.redirect(redirectUrl, {
      status: 302,
      headers: {
        'Set-Cookie': clearStateCookie,
      },
    })
  } catch (err: any) {
    console.error('Lightspeed callback error:', err)
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 })
  }
}
