// Client-side HMAC-SHA256 signing via Web Crypto API.
// API key + secret live in localStorage only — never sent to any server.
// All requests route through the /eapi Vite/Vercel proxy which forwards
// headers (including X-MBX-APIKEY) intact to eapi.binance.com.

const LS_KEY   = 'ochain_api_key'
const LS_SEC   = 'ochain_api_secret'

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

export function hasCredentials(): boolean {
  return !!(localStorage.getItem(LS_KEY) && localStorage.getItem(LS_SEC))
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Build a signed URL for GET requests
export async function signedGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const creds = loadCredentials()
  if (!creds) throw new Error('No API credentials configured')

  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: Date.now().toString(),
    recvWindow: '10000',
  }).toString()

  const signature = await hmacSha256(creds.apiSecret, qs)
  const url       = `/eapi/v1${path}?${qs}&signature=${signature}`

  const res = await fetch(url, {
    headers: { 'X-MBX-APIKEY': creds.apiKey },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Binance ${res.status}: ${body}`)
  }
  return res.json()
}

// Build a signed POST request
export async function signedPost<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const creds = loadCredentials()
  if (!creds) throw new Error('No API credentials configured')

  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: Date.now().toString(),
    recvWindow: '10000',
  })

  const signature = await hmacSha256(creds.apiSecret, body.toString())
  body.append('signature', signature)

  const res = await fetch(`/eapi/v1${path}`, {
    method: 'POST',
    headers: {
      'X-MBX-APIKEY': creds.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Binance ${res.status}: ${txt}`)
  }
  return res.json()
}

// DELETE (cancel order)
export async function signedDelete<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const creds = loadCredentials()
  if (!creds) throw new Error('No API credentials configured')

  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: Date.now().toString(),
    recvWindow: '10000',
  }).toString()

  const signature = await hmacSha256(creds.apiSecret, qs)
  const url       = `/eapi/v1${path}?${qs}&signature=${signature}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'X-MBX-APIKEY': creds.apiKey },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Binance ${res.status}: ${txt}`)
  }
  return res.json()
}
