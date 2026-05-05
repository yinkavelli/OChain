// Vercel serverless proxy for eapi.binance.com
// Called directly at /api/eapi/v1/* from production client code (no rewrite needed).
// Also handles the /eapi/* rewrite for public option chain data.
export default async function handler(req, res) {
  // Extract path segments from the catch-all route
  const segs = req.query.path
  const apiPath = Array.isArray(segs) ? segs.join('/') : (segs || '')

  // Rebuild query string — exclude the internal 'path' routing key
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue
    if (Array.isArray(v)) v.forEach(val => params.append(k, val))
    else params.append(k, String(v))
  }

  const qs       = params.toString()
  const upstream = `https://eapi.binance.com/eapi/${apiPath}${qs ? '?' + qs : ''}`

  const headers = { 'User-Agent': 'OChain/1.1' }

  // Forward the API key header if present
  const apiKey = req.headers['x-mbx-apikey']
  if (apiKey) headers['X-MBX-APIKEY'] = String(apiKey)

  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const rawBody = req.body
    if (rawBody && typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
      const form = new URLSearchParams()
      for (const [k, v] of Object.entries(rawBody)) form.append(k, String(v))
      body = form.toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else if (typeof rawBody === 'string') {
      body = rawBody
      headers['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded'
    }
  }

  try {
    const response = await fetch(upstream, { method: req.method || 'GET', headers, body })
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
