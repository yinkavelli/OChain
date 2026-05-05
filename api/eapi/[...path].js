// Vercel serverless proxy for eapi.binance.com
// URL rewrites strip custom headers — this function forwards them intact.
export default async function handler(req, res) {
  const segs = req.query.path
  const apiPath = Array.isArray(segs) ? segs.join('/') : (segs || '')

  // Rebuild query string, excluding the routing 'path' param added by Vercel
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue
    if (Array.isArray(v)) v.forEach(val => params.append(k, val))
    else params.append(k, String(v))
  }

  const qs = params.toString()
  const upstream = `https://eapi.binance.com/eapi/${apiPath}${qs ? '?' + qs : ''}`

  const headers = { 'User-Agent': 'OChain/1.0' }
  if (req.headers['x-mbx-apikey']) headers['X-MBX-APIKEY'] = req.headers['x-mbx-apikey']

  let body
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body && typeof req.body === 'object') {
      const form = new URLSearchParams()
      for (const [k, v] of Object.entries(req.body)) form.append(k, String(v))
      body = form.toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    } else if (typeof req.body === 'string') {
      body = req.body
      headers['Content-Type'] = req.headers['content-type'] || 'application/x-www-form-urlencoded'
    }
  }

  const response = await fetch(upstream, { method: req.method, headers, body })
  const text = await response.text()

  res.status(response.status)
    .setHeader('Content-Type', response.headers.get('content-type') || 'application/json')
    .setHeader('Access-Control-Allow-Origin', '*')
    .send(text)
}
