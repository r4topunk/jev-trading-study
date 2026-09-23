import { getJson } from './http.ts'

/** One binary market as a proposition: the YES token pays if `yes` happens. Prices below are for the YES token. */
export type Prop = {
  venue: 'limitless' | 'polymarket'
  id: string
  slug: string
  title: string
  yes: string
  no: string
  rules: string
  end: number
  yesToken: string
  url: string
  /** Taker fee per share = feeRate * min(p, 1 - p): an upper-bound reading of both venues' fee schedules. */
  feeRate: number
  sports: boolean
}

/** YES-token book, best level first. Buying NO at q is selling YES at 1 - q (both venues match complementary tokens). */
export type Book = { bids: [number, number][]; asks: [number, number][] }

// Limitless publishes settings.c = "3" and a rebate rate, but no fee formula: assume 3% of min(p, 1 - p). UNKNOWN in ARB.md.
const LIMITLESS_FEE = 0.03

const strip = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
const toSec = (x: number | string) => (Number(x) > 1e12 ? Math.floor(Number(x) / 1000) : Number(x))

export async function limitless(): Promise<Prop[]> {
  const out: Prop[] = []
  for (let page = 1; ; page++) {
    const r = await getJson<{ data: any[] }>(`https://api.limitless.exchange/markets/active?page=${page}&limit=25`)
    if (!r.data?.length) break
    for (const m of r.data) {
      const subs = m.marketType === 'group' ? (m.markets ?? []).map((s: any) => ({ ...s, _group: m.title })) : [m]
      for (const s of subs) {
        if (!s.tokens?.yes || s.expired) continue
        const sides = !s._group && / vs\.? /i.test(s.title) ? s.title.split(/ vs\.? /i).map((x: string) => x.split(':')[0]!.trim()) : null
        out.push({
          venue: 'limitless', id: String(s.id), slug: s.slug,
          title: s._group ? `${s._group} — ${s.title}` : s.title,
          yes: sides?.[0] ?? 'Yes', no: sides?.[1] ?? 'No',
          rules: strip(s.description ?? m.description ?? '').slice(0, 1500),
          end: toSec(s.expirationTimestamp ?? m.expirationTimestamp),
          yesToken: s.tokens.yes, url: `https://limitless.exchange/markets/${s.slug}`,
          feeRate: LIMITLESS_FEE, sports: (m.categories ?? []).some((c: string) => /sport|football|esport/i.test(c)),
        })
      }
    }
  }
  return out
}

export async function polymarket(maxDays = 400): Promise<Prop[]> {
  const out: Prop[] = []
  const endMax = new Date(Date.now() + maxDays * 86400e3).toISOString()
  // Offset pagination stops at 2,000; the keyset endpoint walks the whole set with a cursor.
  for (let cursor = ''; ; ) {
    const r = await getJson<{ markets: any[]; next_cursor?: string }>(
      `https://gamma-api.polymarket.com/markets/keyset?active=true&closed=false&limit=100&end_date_max=${endMax}&liquidity_num_min=100${cursor ? `&after_cursor=${encodeURIComponent(cursor)}` : ''}`,
    )
    for (const m of r.markets ?? []) {
      if (!m.enableOrderBook || !m.acceptingOrders) continue
      const outcomes = JSON.parse(m.outcomes ?? '[]'), tokens = JSON.parse(m.clobTokenIds ?? '[]')
      if (outcomes.length !== 2 || tokens.length !== 2) continue
      out.push({
        venue: 'polymarket', id: String(m.id), slug: m.slug,
        title: m.question, yes: outcomes[0], no: outcomes[1],
        rules: strip(m.description ?? '').slice(0, 1500),
        end: Math.floor(Date.parse(m.endDate) / 1000),
        yesToken: tokens[0], url: `https://polymarket.com/market/${m.slug}`,
        feeRate: m.feesEnabled ? (m.feeSchedule?.rate ?? 0.04) : 0,
        sports: Boolean(m.sportsMarketType || m.gameStartTime),
      })
    }
    if (!r.next_cursor || !r.markets?.length) break
    cursor = r.next_cursor
  }
  return out
}

export async function book(p: Prop): Promise<Book> {
  if (p.venue === 'polymarket') {
    const b = await getJson<any>(`https://clob.polymarket.com/book?token_id=${p.yesToken}`)
    return {
      bids: b.bids.map((x: any) => [Number(x.price), Number(x.size)] as [number, number]).sort((a: any, c: any) => c[0] - a[0]),
      asks: b.asks.map((x: any) => [Number(x.price), Number(x.size)] as [number, number]).sort((a: any, c: any) => a[0] - c[0]),
    }
  }
  const b = await getJson<any>(`https://api.limitless.exchange/markets/${p.slug}/orderbook`)
  return {
    bids: (b.bids ?? []).map((x: any) => [Number(x.price), Number(x.size) / 1e6] as [number, number]).sort((a: any, c: any) => c[0] - a[0]),
    asks: (b.asks ?? []).map((x: any) => [Number(x.price), Number(x.size) / 1e6] as [number, number]).sort((a: any, c: any) => a[0] - c[0]),
  }
}
