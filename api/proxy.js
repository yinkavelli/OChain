// Single proxy function for eapi.binance.com
// API key + secret are read from Vercel environment variables (server-side only).
// Client sends bare requests — this function adds auth and signs before forwarding.
import crypto from 'crypto'

function sign(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

const PRIVATE = new Set(['account', 'position', 'openOrders', 'historyOrders', 'order', 'userTrades'])

function needsSigning(epath) {
  return PRIVATE.has(epath.split('/').pop().split('?')[0])
}

export default async function handler(req, res) {
  // Path comes as ?p=v1/account (query param avoids catch-all routing issues)
  const url     = new URL(req.url, 'http://localhost')
  const epath   = url.searchParams.get('p') || ''
  url.searchParams.delete('p')

  const apiKey    = process.env.BINANCE_API_KEY
  const apiSecret = process.env.BINANCE_API_SECRET

  const headers = { 'User-Agent': 'OChain/1.1' }
  let body, qs

  const isPrivate  = needsSigning(epath)
  const hasEnvCreds = apiKey && apiSecret

  if (isPrivate && hasEnvCreds) {
    headers['X-MBX-APIKEY'] = apiKey

    if (req.method === 'GET' || req.method === 'DELETE') {
      url.searchParams.set('timestamp',  Date.now().toString())
      url.searchParams.set('recvWindow', '10000')
      const qStr = url.searchParams.toString()
      url.searchParams.set('signature', sign(apiSecret, qStr))
      qs = url.searchParams.toString()
    } else {
      // POST — body is form-encoded
      const form = new URLSearchParams()
      const raw  = req.body
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw)) form.append(k, String(v))
      }
      form.set('timestamp',  Date.now().toString())
      form.set('recvWindow', '10000')
      form.set('signature',  sign(apiSecret, form.toString()))
      body = form.toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      qs = ''
    }
  } else {
    // Public endpoint — just proxy as-is
    qs = url.searchParams.toString()
  }

  const upstream = `https://eapi.binance.com/eapi/${epath}${qs ? '?' + qs : ''}`

  try {
    const response = await fetch(upstream, {
      method:  req.method || 'GET',
      headers,
      ...(body ? { body } : {}),
    })
    const text = await response.text()
    res
      .status(response.status)
      .setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
      .setHeader('Access-Control-Allow-Origin', '*')
      .send(text)
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message })
  }
}
