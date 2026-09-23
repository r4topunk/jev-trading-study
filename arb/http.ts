import { Resolver } from 'node:dns'
import { get } from 'node:https'

// Read-only research: GET requests to public market-data endpoints, no account, no orders.
// Optional ARB_DNS=1.1.1.1,8.8.8.8 resolves hostnames through those servers instead of the system resolver.
const DNS = process.env.ARB_DNS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
const resolver = new Resolver()
if (DNS.length) resolver.setServers(DNS)

const lookup = (host: string, opts: { all?: boolean }, cb: (...a: any[]) => void) =>
  resolver.resolve4(host, (err, addrs) => {
    if (err || !addrs.length) return cb(err ?? new Error(`no A record for ${host}`))
    opts?.all ? cb(null, addrs.map((address) => ({ address, family: 4 }))) : cb(null, addrs[0], 4)
  })

export function getJson<T = any>(url: string, tries = 4): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const req = get(url, { headers: { 'user-agent': 'jev-trader-research', accept: 'application/json' }, timeout: 20_000, ...(DNS.length ? { lookup } : {}) }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        if (res.statusCode === 429 || (res.statusCode ?? 500) >= 500) return reject(Object.assign(new Error(`HTTP ${res.statusCode} ${url}`), { retry: true }))
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}: ${body.slice(0, 200)}`))
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    })
    req.on('timeout', () => req.destroy(Object.assign(new Error(`timeout ${url}`), { retry: true })))
    req.on('error', (e) => reject(Object.assign(e, { retry: true })))
  }).catch(async (e) => {
    if (!e.retry || tries <= 1) throw e
    await new Promise((r) => setTimeout(r, 1500 * (5 - tries)))
    return getJson<T>(url, tries - 1)
  })
}
