// app/api/lightspeed/auth/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const LS_AUTHORIZE_URL = process.env.LS_AUTHORIZE_URL || 'https://cloud.lightspeedapp.com/oauth/authorize'
  const LS_API_KEY = process.env.LS_API_KEY
  const LS_REDIRECT_URI = process.env.LS_REDIRECT_URI

  if (!LS_API_KEY || !LS_REDIRECT_URI) {
    return NextResponse.json(
      { ok: false, error: 'Missing LS_API_KEY or LS_REDIRECT_URI in environment.' },
      { status: 500 }
    )
  }

  // simple state token (short-lived). We set it as an HttpOnly cookie and check it in the callback.
  const state = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  // Build authorize URL. Add scope if your Lightspeed app requires specific scopes (e.g. offline_access).
  const params = new URLSearchParams({
    client_id: LS_API_KEY,
    response_type: 'code',
    redirect_uri: LS_REDIRECT_URI,
    state,
    // scope: 'offline_access' // uncomment/add scopes if your Lightspeed app needs them
  })

  const authorizeUrl = `${LS_AUTHORIZE_URL}?${params.toString()}`

  // Set a short-lived HttpOnly cookie containing the state (10 minutes).
  // NextResponse.redirect accepts headers, so we set Set-Cookie directly.
  const cookie = `ls_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${10 * 60}`

  return NextResponse.redirect(authorizeUrl, {
    status: 302,
    headers: { 'Set-Cookie': cookie },
  })
}
