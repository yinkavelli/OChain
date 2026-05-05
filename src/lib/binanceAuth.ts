// Auth layer for Binance eapi private endpoints.
//
// Production (Vercel): calls go to /api/proxy?p=v1/...
//   The serverless function reads BINANCE_API_KEY + BINANCE_API_SECRET
//   from Vercel environment variables and signs server-side.
//   Client sends bare requests — no key ever touches the browser.
//
// Dev (Vite): Vite proxy forwards /eapi/v1/* to eapi.binance.com.
//   Client signs with localStorage credentials and sends X-MBX-APIKEY.

const IS_PROD   = import.meta.env.PROD
const DEV_BASE  = '/eapi/v1'

const LS_KEY = 'ochain_api_key'
const LS_SEC = 'ochain_api_secret'

export interface ApiCredentials { apiKey: string; apiSecret: string }

export function saveCredentials(creds: ApiCredentials) {
  localStorage.setItem(LS_KEY, creds.apiKey)
  localStorage.setItem(LS_SEC, creds.apiSecret)
}

export function loadCredentials(): ApiCredentials | null {
  const apiKey    = localStorage.getItem(LS_KEY)
  const apiSecret = localStorage.getItem(LS_SEC)
  if (!apiKey || !apiSecret) return null
  return { apiKey, apiSecret }
}

export function clearCredentials() {
  localStorage.removeItem(LS_KEY)
  localStorage.removeItem(LS_SEC)
}

// In production, credentials live in Vercel env vars — no localStorage needed.
export function hasCredentials(): boolean {
  if (IS_PROD) return true   // assume env vars are configured
  return !!(localStorage.getItem(LS_KEY) && localStorage.getItem(LS_SEC))
}

// Build a production proxy URL: /api/proxy?p=v1/account
function prodUrl(path: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({
    p: `v1${path}`,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  }).toString()
  return `/api/proxy?${qs}`
}

// ── HMAC signing for dev ───────────────────────────────────────────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Signed GET ────────────────────────────────────────────────────────

export async function signedGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  // Production: bare call — server signs with env vars
  if (IS_PROD) {
    const res = await fetch(prodUrl(path, params))
    if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`)
    return res.json()
  }

  // Dev: client-side signing
  const creds = loadCredentials()
  if (!creds) throw new Error('No API credentials — add them in Settings')

  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: Date.now().toString(),
    recvWindow: '10000',
  }).toString()

  const signature = await hmacSha256(creds.apiSecret, qs)
  const res = await fetch(`${DEV_BASE}${path}?${qs}&signature=${signature}`, {
    headers: { 'X-MBX-APIKEY': creds.apiKey },
  })
  if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Signed POST ───────────────────────────────────────────────────────

export async function signedPost<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  // Production: send params in body — server adds timestamp+signature
  if (IS_PROD) {
    const body = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    )
    const res = await fetch(prodUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`)
    return res.json()
  }

  // Dev: client-side signing
  const creds = loadCredentials()
  if (!creds) throw new Error('No API credentials — add them in Settings')

  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: Date.now().toString(),
    recvWindow: '10000',
  })
  const signature = await hmacSha256(creds.apiSecret, body.toString())
  body.append('signature', signature)

  const res = await fetch(`${DEV_BASE}${path}`, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': creds.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── Signed DELETE ─────────────────────────────────────────────────────

export async function signedDelete<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  if (IS_PROD) {
    const res = await fetch(prodUrl(path, params), { method: 'DELETE' })
    if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`)
    return res.json()
  }

  const creds = loadCredentials()
  if (!creds) throw new Error('No API credentials — add them in Settings')

  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: Date.now().toString(),
    recvWindow: '10000',
  }).toString()
  const signature = await hmacSha256(creds.apiSecret, qs)

  const res = await fetch(`${DEV_BASE}${path}?${qs}&signature=${signature}`, {
    method: 'DELETE',
    headers: { 'X-MBX-APIKEY': creds.apiKey },
  })
  if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`)
  return res.json()
}
