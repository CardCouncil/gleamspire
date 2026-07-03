// All Scryfall API traffic goes through this module so the whole app shares
// one rate-limited queue. Scryfall's hard limits: /cards/search, /cards/named
// and /cards/collection allow 2 requests/second (500ms); everything else 10/second
// (100ms). A 429 blocks the client for ~30 seconds, so limits must be respected.

export class ScryfallError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

export class ScryfallRateLimitError extends ScryfallError {}

type RateTier = 'search' | 'default'

// 10% margin over Scryfall's published 500ms/100ms minimum spacing
const SPACING_MS: Record<RateTier, number> = { search: 550, default: 110 }
const MAX_ATTEMPTS = 3
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const SETS_CACHE_KEY = 'scryfall:sets:v1'
const SYMBOLOGY_CACHE_KEY = 'scryfall:symbology:v1'

export const SEARCH_CHUNK_SIZE = 10

export interface ScryfallSet {
  code: string
  name: string
  icon_svg_uri: string
  released_at: string
}

export interface ScryfallCardSymbol {
  symbol: string
  svg_uri: string
  english: string
  represents_mana: boolean
  appears_in_mana_costs: boolean
  cmc: number | null
  loose_variant?: string | null
  transposable?: boolean
}

export interface ScryfallCard {
  name: string
  set: string
  set_name: string
  set_type: string
  collector_number: string
  released_at: string
  rarity: string
  mana_cost?: string
  color_identity?: string[]
  type_line?: string
  games?: string[]
  card_faces?: { name: string }[]
  prints_search_uri?: string
}

export interface PrintingsResult {
  byName: Map<string, ScryfallCard[]>
  notFound: string[]
}

interface ScryfallList<T> {
  data: T[]
  has_more: boolean
  next_page?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Serial promise queue: every request chains on the previous one, and
// nextAllowedAt enforces start-to-start spacing per tier.
let queueTail: Promise<unknown> = Promise.resolve()
let nextAllowedAt = 0

function scryfallRequest<T>(url: string, tier: RateTier): Promise<T> {
  const run = queueTail.then(() => executeWithRetry<T>(url, tier))
  // Swallow rejections on the tail so one failed request never poisons the queue
  queueTail = run.catch(() => {})
  return run
}

async function executeWithRetry<T>(url: string, tier: RateTier, attempt = 0): Promise<T> {
  const wait = nextAllowedAt - Date.now()
  if (wait > 0) await sleep(wait)
  nextAllowedAt = Date.now() + SPACING_MS[tier]

  let response: Response
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch (e) {
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new ScryfallError('Network error contacting Scryfall: ' + (e as Error).message, 0)
    }
    await sleep(2000)
    return executeWithRetry<T>(url, tier, attempt + 1)
  }

  if (response.status === 429) {
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new ScryfallRateLimitError('Scryfall rate limit exceeded', 429)
    }
    // Scryfall blocks for ~30s after a 429; stall the whole queue before retrying
    const retryAfter = Number(response.headers.get('Retry-After'))
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000
    nextAllowedAt = Date.now() + delay
    return executeWithRetry<T>(url, tier, attempt + 1)
  }

  if (response.status >= 500) {
    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new ScryfallError(`Scryfall server error (${response.status})`, response.status)
    }
    await sleep(2000)
    return executeWithRetry<T>(url, tier, attempt + 1)
  }

  if (!response.ok) {
    let details: string | undefined
    try {
      details = (await response.json())?.details
    } catch {
      // non-JSON error body
    }
    throw new ScryfallError(details || `Scryfall request failed (${response.status})`, response.status)
  }

  return response.json()
}

async function fetchAllPages<T>(firstUrl: string, tier: RateTier, maxPages = 25): Promise<T[]> {
  const results: T[] = []
  let url: string | undefined = firstUrl
  for (let page = 0; url && page < maxPages; page++) {
    const list: ScryfallList<T> = await scryfallRequest<ScryfallList<T>>(url, tier)
    results.push(...list.data)
    url = list.has_more ? list.next_page : undefined
  }
  if (url) {
    console.warn('Scryfall pagination stopped at maxPages; results may be incomplete:', firstUrl)
  }
  return results
}

function readCache<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const payload = JSON.parse(raw) as { ts: number; data: T[] }
    if (!payload || !Array.isArray(payload.data) || Date.now() - payload.ts > CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return payload.data
  } catch {
    try { localStorage.removeItem(key) } catch { /* localStorage unavailable */ }
    return null
  }
}

function writeCache<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // Quota exceeded or localStorage unavailable — just skip caching
  }
}

let setsInflight: Promise<ScryfallSet[]> | null = null

export function getSets(): Promise<ScryfallSet[]> {
  const cached = readCache<ScryfallSet>(SETS_CACHE_KEY)
  if (cached) return Promise.resolve(cached)
  if (!setsInflight) {
    setsInflight = fetchAllPages<ScryfallSet>('https://api.scryfall.com/sets', 'default')
      .then(sets => {
        // Project down to only the fields the app uses before caching
        const lean = sets.map(({ code, name, icon_svg_uri, released_at }) => ({
          code, name, icon_svg_uri, released_at
        }))
        writeCache(SETS_CACHE_KEY, lean)
        return lean
      })
      .catch(e => {
        setsInflight = null
        throw e
      })
  }
  return setsInflight
}

let symbologyInflight: Promise<ScryfallCardSymbol[]> | null = null

export function getSymbology(): Promise<ScryfallCardSymbol[]> {
  const cached = readCache<ScryfallCardSymbol>(SYMBOLOGY_CACHE_KEY)
  if (cached) return Promise.resolve(cached)
  if (!symbologyInflight) {
    symbologyInflight = fetchAllPages<ScryfallCardSymbol>('https://api.scryfall.com/symbology', 'default')
      .then(all => {
        const lean = all.map(s => ({
          symbol: s.symbol,
          svg_uri: s.svg_uri,
          english: s.english,
          represents_mana: s.represents_mana,
          appears_in_mana_costs: s.appears_in_mana_costs,
          cmc: s.cmc,
          loose_variant: s.loose_variant,
          transposable: s.transposable
        }))
        writeCache(SYMBOLOGY_CACHE_KEY, lean)
        return lean
      })
      .catch(e => {
        symbologyInflight = null
        throw e
      })
  }
  return symbologyInflight
}

// Deck lists write multi-face names several ways ("A / B", "A/B", "A // B");
// Scryfall's canonical separator is " // ".
function normalizeCardName(name: string): string {
  return name.replace(/\s*\/{1,2}\s*/g, ' // ')
}

// Scryfall search strings accept either "double" or 'single' quote delimiters.
// Names containing both kinds (none exist today) fall back to /cards/named.
function quoteName(name: string): string | null {
  if (!name.includes('"')) return `!"${name}"`
  if (!name.includes("'")) return `!'${name}'`
  return null
}

function matchesName(card: ScryfallCard, target: string): boolean {
  const full = card.name.toLowerCase()
  if (full === target) return true
  if (full.split(' // ').some(part => part.trim() === target)) return true
  if (card.card_faces?.some(face => face.name.toLowerCase() === target)) return true
  return false
}

/**
 * Fetch all paper printings for up to ~SEARCH_CHUNK_SIZE card names in one
 * batched OR'd search query. Results are grouped back to the requested names
 * (matching full names, split/DFC segments, and face names); names with no
 * matches are returned in notFound rather than throwing.
 */
export async function searchPrintingsByNames(names: string[]): Promise<PrintingsResult> {
  const quotedTerms: string[] = []
  const unquotable: string[] = []
  for (const name of names) {
    const quoted = quoteName(normalizeCardName(name))
    if (quoted) quotedTerms.push(quoted)
    else unquotable.push(name)
  }

  const cards: ScryfallCard[] = []

  if (quotedTerms.length > 0) {
    const query = `(${quotedTerms.join(' or ')}) game:paper`
    const params = new URLSearchParams({ q: query, unique: 'prints' })
    try {
      cards.push(...await fetchAllPages<ScryfallCard>(
        `https://api.scryfall.com/cards/search?${params}`, 'search'
      ))
    } catch (e) {
      // 404 from search means zero matches for the whole chunk, not a failure
      if (!(e instanceof ScryfallError && e.status === 404)) throw e
    }
  }

  for (const name of unquotable) {
    try {
      const params = new URLSearchParams({ exact: normalizeCardName(name) })
      const card = await scryfallRequest<ScryfallCard>(
        `https://api.scryfall.com/cards/named?${params}`, 'search'
      )
      if (card.prints_search_uri) {
        const prints = await fetchAllPages<ScryfallCard>(card.prints_search_uri, 'search')
        // prints_search_uri has no game:paper filter, so apply it client-side
        cards.push(...prints.filter(p => !p.games || p.games.includes('paper')))
      } else {
        cards.push(card)
      }
    } catch (e) {
      // 404 → unknown name; grouping below will report it as notFound
      if (!(e instanceof ScryfallError && e.status === 404)) throw e
    }
  }

  const byName = new Map<string, ScryfallCard[]>()
  const notFound: string[] = []
  for (const requested of names) {
    const target = normalizeCardName(requested).toLowerCase()
    const matched = cards.filter(card => matchesName(card, target))
    if (matched.length > 0) byName.set(requested, matched)
    else notFound.push(requested)
  }

  return { byName, notFound }
}
