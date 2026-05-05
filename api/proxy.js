import crypto from 'crypto'

function sign(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

const PRIVATE = new Set([
  'account', 'position', 'openOrders', 'historyOrders', 'order', 'userTrades',
])

function needsSigning(epath) {
  const last = epath.split('/').pop()?.split('?')[0] ?? ''
  return PRIVATE.has(last)
}

export default async function handler(req, res) {
  const url    = new URL(req.url, 'http://localhost')
  const epath  = url.searchParams.get('p') || ''
  url.searchParams.delete('p')

  // Trim to remove any accidental whitespace/newlines from copy-paste
  const apiKey    = (process.env.BINANCE_API_KEY    || '').trim()
  const apiSecret = (process.env.BINANCE_API_SECRET || '').trim()

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: 'Missing Binance credentials',
      hint: 'Add BINANCE_API_KEY and BINANCE_API_SECRET in Vercel project settings → Environment Variables, then redeploy.',
    })
  }

  const headers = { 'User-Agent': 'OChain/1.1' }
  let body, qs

  const isPrivate = needsSigning(epath)

  if (isPrivate) {
    headers['X-MBX-APIKEY'] = apiKey

    if (req.method === 'GET' || req.method === 'DELETE') {
      url.searchParams.set('timestamp',  Date.now().toString())
      url.searchParams.set('recvWindow', '10000')
      const qStr = url.searchParams.toString()
      url.searchParams.set('signature', sign(apiSecret, qStr))
      qs = url.searchParams.toString()
    } else {
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
    qs = url.searchParams.toString()
  }

  // Spot paths are prefixed with "spot" — route to api.binance.com instead
  let upstream
  if (epath.startsWith('spot/')) {
    upstream = `https://api.binance.com/${epath.slice(5)}${qs ? '?' + qs : ''}`
  } else {
    upstream = `https://eapi.binance.com/eapi/${epath}${qs ? '?' + qs : ''}`
  }

  try {
    const response = await fetch(upstream, {
      method:   req.method || 'GET',
      headers,
      redirect: 'manual',   // never follow redirects — return real Binance errors
      ...(body ? { body } : {}),
    })

    // Binance redirects invalid/rejected requests to www.binance.com/en/error
    // Intercept this and return a meaningful error instead of raw HTML
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || ''
      const isOptionsBlock = location.includes('binance.com')
      return res.status(403).json({
        error: isOptionsBlock
          ? 'Binance rejected the request — check API key permissions'
          : `Redirect to ${location}`,
        hint: 'In Binance → API Management, enable "Enable European Options Trading". Even Read Info requests to /eapi require this permission.',
        upstream,
      })
    }

    const text = await response.text()

    // Try to surface clean JSON errors from Binance instead of raw HTML
    let parsed
    try { parsed = JSON.parse(text) } catch { /* not JSON */ }

    if (!response.ok && parsed?.msg) {
      return res.status(response.status).json({ error: parsed.msg, code: parsed.code })
    }

    res
      .status(response.status)
      .setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
      .setHeader('Access-Control-Allow-Origin', '*')
      .send(text)

  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message })
  }
}
