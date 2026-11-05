# Similar Song AI — developer notes

> Living document. A new session should be able to continue from **Progress** below.

## 1. Concept (brainstorm)

**Problem.** "Similar songs" tools either give a bare list (no reason to trust it) or are black-box playlists. Spotify's recommendation and audio-features endpoints are closed to new apps, so the obvious data source is gone.

**Idea.** A web app where you type one song and get suggestions you can *understand*, *steer* and *share*:

| Pillar | What it means | How |
| --- | --- | --- |
| Good suggestions | Collaborative signal + content signal | Last.fm `track.getSimilar` (listening behaviour) blended with weighted tag overlap |
| Explained | One sentence per pick, grounded in real data | LLM sees *only* a facts packet (shared/unique tags, Last.fm score, popularity bucket, years); output is validated, else a deterministic template is used |
| Steerable | Vibe controls | Popularity ↔ obscurity, older ↔ newer, calm ↔ intense, mood chips (derived from tags) |
| Journey | Playlist that glides A → B | Genre-route planner + tag-space interpolation (see §4) |
| Keepable | Save + share | Playlists in `localStorage`, canvas-rendered 4:5 share card PNG |

**Ideas considered and parked** (see Roadmap): MusicBrainz enrichment for exact release dates, "taste profile" from several seeds, Spotify/Apple playlist export, account sync, audio-feature estimation from preview clips, lyrics themes.

**Design direction.** Dark, large bold type (Inter variable), blurred artwork backdrop that crossfades to whatever is playing, glass surfaces (`backdrop-filter`), spring-ish easing, staggered row entrances, reduced-motion respected. No Apple names/logos/marks: the brand is "Similar Song AI" with two overlapping rings as the logo and a coral→amber accent.

## 2. Setup

Requirements: Node 20+ (developed on Node 22), npm.

```bash
npm install
cp .env.example .env.local   # then fill in keys (all optional - see below)
npm run dev                  # http://localhost:3000
```

Quality gates: `npm run check` (typecheck + lint + tests). Production build: `npm run build && npm start`.

### Environment variables / accounts

| Variable | Needed? | Where to get it | Notes |
| --- | --- | --- | --- |
| `LASTFM_API_KEY` | Recommended | https://www.last.fm/api/account/create (free, instant) | Server-side only. Missing ⇒ **mock mode** (bundled 48-song catalogue, no network) |
| `GEMINI_API_KEY` | Optional | https://aistudio.google.com/apikey (free tier) | Primary LLM |
| `GROQ_API_KEY` | Optional | https://console.groq.com/keys (free tier) | Fallback LLM |
| `LLM_PROVIDER` | Optional | `auto` (default) / `gemini` / `groq` / `none` | `auto` tries Gemini then Groq |
| `GEMINI_MODEL` | Optional | comma list, tried in order | default `gemini-3.1-flash-lite,gemini-flash-lite-latest` (Google retires/ rate-limits free models often) |
| `GROQ_MODEL` | Optional | | default `openai/gpt-oss-20b` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional | https://console.upstash.com (free Redis; Vercel KV's `KV_REST_API_URL`/`KV_REST_API_TOKEN` also work) | Enables the persistent cache tier (see §3) |
| `MOCK_MODE` | Optional | `1` forces mock data | useful for demos/offline |

No key is ever sent to the browser. Deezer's public API and image CDN need no key. Without LLM keys explanations come from a deterministic tag template (badge "AI" is only shown on LLM-written text).

Handy: `DEBUG_TIMING=1` logs phase timings and rejected LLM outputs.

## 3. Architecture

```
Browser (React 19, App Router)
  └─ /api/search      Deezer search (autocomplete)  -> Last.fm track.search fallback
  └─ /api/similar     seed + Last.fm neighbours -> enrich tags -> rank with vibe -> JSON
  └─ /api/explain     facts rebuilt server-side from cache -> LLM -> grounding check -> template fallback
  └─ /api/journey     NDJSON stream (progress events + result)
  └─ /api/enrich      lazy Deezer artwork / year / preview availability (per row)
  └─ /api/preview     fresh signed 30s preview URL (they expire ~15 min)
  └─ /api/img         allow-listed same-origin image proxy (canvas share card only)
  └─ /api/status      {mock, llm[]} for badges (never returns secrets)
```

Key modules (`src/lib`):
- `sources/` Last.fm, Deezer, mock behind two small interfaces (`LastfmSource`, `DeezerSource`); `sources/index.ts` picks real vs mock at call time.
- `cache.ts` TTL-LRU, `memoize` (+ in-flight de-dupe, failures not cached), `Limiter` (rate spacing + concurrency), `mapLimit`.
- `catalog.ts` `getTrack` (Last.fm: tags/listeners) and `hydrate` (Deezer: art/year) — split so ranking stays fast and art streams in lazily.
- `music/scoring.ts` ranking; `music/tags.ts` tag cleaning, vectors, mood/energy lexicon; `music/journey.ts` + `genres.ts` journey planning.
- `llm/` provider abstraction (`LLMProvider.completeJSON`), `facts.ts`, `grounding.ts`, `template.ts`, `explain.ts`.
- `client/` fetch helpers, hydration store, library store (localStorage), share card renderer, backdrop store.

### Caching & rate limits
- Last.fm: ≤10 req/s burst via `Limiter(10, 12)`; track info 3 d, similar lists 1 d, artist data 2–3 d. Deezer: `Limiter(8, 6)` (documented 50/5 s). Quota errors (HTTP 200 + `error.code 4`) are retried, never cached as "no result".
- Deezer preview URLs are signed and expire in ~15 min → never stored in caches or saved playlists; `/api/preview` resolves them on play (6 min server TTL).
- API responses carry `Cache-Control: s-maxage` so a CDN can absorb repeat queries. Cache is per server instance (fine for free tiers).
- Cold similar request ≈ 4–6 s (≈24 Last.fm lookups); warm ≈ instant. Journey cold ≈ 7–15 s (streamed progress).

### Persistent cache (optional)
`memoize(..., { persist: true })` adds a Redis tier (`src/lib/persist.ts`, Upstash REST over `fetch`, no dependency) behind the in-memory cache, which stays the default and is always checked first. Only upstream-derived Last.fm / Deezer match lookups are persisted (3 d–7 d TTLs, keys `ssai:v1:*`); search, previews and LLM output are not. Every Redis failure degrades to a cache miss, and 3 consecutive failures switch the tier off for 60 s. Writes are fire-and-forget, so on serverless a write may occasionally be dropped when the function freezes. `/api/status` reports `persistentCache`.

### Shareable links (`src/lib/share-link.ts`, `SharedView`)
`/?s=<v>.<base64url>`: JSON `{n, t:[[artist,title]…]}` (≤ 40 tracks), deflate-raw compressed when `CompressionStream` exists (`v=1`), else plain (`v=0`). Nothing is stored server-side; the receiver re-resolves artwork/previews. Links are untrusted input: size-limited, shape-checked, invalid ones show a friendly error. Created from the share-card modal ("Copy link").

### Result diversity
The seed's artist gets at most 1 slot in the main list (`seedArtistCap`), other artists max 2. Same-artist candidates (plus the artist's top tracks if needed) feed a separate "More from {artist}" row (`moreFromArtist` in `/api/similar`).

### Ranking (`music/scoring.ts`)
`score = 0.55·lastfmMatch + 0.45·tagSimilarity + vibe`, where vibe = `0.5·popularityBias + 0.4·eraBias + 0.45·energyBias + 0.7·moodFit`. Biases are signed and zero at the neutral slider position, so untouched controls never distort results. At most 2 tracks per artist; remasters/edits of the seed are dropped.
- Popularity: log-scaled Last.fm listeners. Era: release year (Deezer date or earlier ISRC year — reissue heuristic). Energy/mood: from a tag lexicon (no audio features exist any more).
- Pool is 24 neighbours (36 when mood/energy/obscure is requested) before ranking.

### Journey (`music/journey.ts`)
Last.fm similarity never leaves a genre cluster, so A→B across genres needs help: (1) BFS over a hand-built genre graph gives a route (e.g. thrash metal → metal → industrial → electronic → downtempo); (2) `tag.getTopTracks` per genre on the route + neighbours of A and B form the pool; (3) for each step the "ideal" point is the A→B tag-vector interpolation blended with the route genre at that progress; greedy pick maximises `0.68·onPath + 0.24·continuity + 0.08·lastfm`, one track per artist.

### Grounding the LLM
Prompt = strict system rules + JSON facts only. Output is `{"items":[{id,text,evidence[]}]}` and rejected (→ template) unless: evidence keys exist in the packet, every number is from the packet, every mid-sentence capitalised word appears in the packet, no links/markdown, ≤ 260 chars. Tags are sanitised (they are user-generated ⇒ prompt-injection vector). `/api/explain` rebuilds facts server-side from ids, so clients can't inject arbitrary prompts. Per-IP rate limits protect the LLM quota. This is a heuristic guard, not a proof — documented in Known issues.

## 4. Deploy (free tiers)

**Vercel (Hobby)**: import the GitHub repo → framework Next.js (auto) → add env vars (`LASTFM_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`) → deploy. Routes set `maxDuration = 60`, the Hobby maximum; journey cold-starts can approach 15 s, well inside it.
**Alternatives**: Cloudflare Pages/Workers via OpenNext, Render/Fly free web service (`npm run build && npm start`), or any Node host. Nothing else to provision (no DB).

## 5. Known issues / limitations
- Some catalogues are missing on Deezer in some regions (e.g. Metallica returned no results from the sandbox): those rows show a generated gradient and "No preview available".
- Release years are a heuristic (earlier of Deezer date and ISRC year); remasters can still be off by a few years.
- LLM grounding check is heuristic; a sentence can still be vague or slightly awkward, but it cannot cite numbers/names/tags that weren't supplied.
- Last.fm tags are crowd-sourced: occasional odd tags (e.g. "kick") survive the junk filter.
- In-memory caches reset on cold start/serverless scale-out; the first query for a new song costs ~5 s.
- Mood/energy come from tags only (Spotify audio features are gone), so very niche songs without tags get neutral energy.
- Safari < 18 lacks `ctx.filter`; the share card still renders (saturation boost skipped).
- No accounts: playlists live in this browser's `localStorage`.

## 6. Decisions
- **Branch**: the task says `claude/v1`; the harness also assigned `claude/similar-song-ai-v1-6q2c4g`. Work is done on `claude/v1` and mirrored to the assigned branch at each push. PR is from `claude/v1`.
- **Next.js 16 + React 19, plain CSS** (no Tailwind) for full control of the glass/blur look; Inter via `@fontsource-variable/inter` (self-hosted, no build-time network).
- **State in the URL** (`?a=&t=` seed, `?m=journey&a=&t=&a2=&t2=&n=`) so back/forward and links work.
- **Autocomplete from Deezer**, not Last.fm: faster, has artwork; mapped to Last.fm by (artist, cleaned title).
- **Split enrichment**: ranking needs only Last.fm; artwork/year/preview are lazy per row to keep time-to-results low.
- **Explanations are a separate request** so results appear immediately and text fades in.
- **Evidence chips** highlight tags the explanation actually cited.
- **Own genre graph** for journeys instead of an extra data source (free, deterministic, unit-tested).
- **Titles shown without "(feat. …)"** but never altered in lookups.
- **Playlist storage** keeps only `{id, artist, title, album, artwork, deezerId}`; no signed URLs.
- **Share card** rendered on a canvas client-side (no deps, works offline) with art routed through an allow-listed proxy for CORS.
- **Same-artist cap = 1 in main list + separate row** rather than dropping them: users still want the artist's other songs, just not as the whole list.
- **Links carry content, not an id**: no database, links never expire, and nothing personal is stored.
- **Redis via REST/fetch** instead of an SDK: zero new dependencies, works on Vercel/Cloudflare/Node.
- **MusicBrainz not used** (optional in the brief): 1 req/s is too slow for per-row enrichment; see Roadmap.
- **Mock mode** triggers when `LASTFM_API_KEY` is missing (or `MOCK_MODE=1`), including a mock Deezer so the demo is consistent offline.
- **Vitest** (not Jest) for speed; tests cover core logic and run the whole pipeline on mock data.

## 7. Blockers & workarounds
| What failed | What I tried | Result / what you may need to do |
| --- | --- | --- |
| Spotify recommendations/audio-features closed | — | Replaced by Last.fm similarity + tag lexicons |
| Deezer preview URLs expire in ~15 min | Checked the `hdnea exp` timestamp | Resolve on play via `/api/preview`; never persist |
| Deezer quota errors arrive as HTTP 200 | Saw empty results cached as "not found" | `get()` detects `error`, retries, never caches failures |
| `gemini-2.5-flash` returns 404 "no longer available to new users"; newer flash models 429 on the free quota | Listed models via API, probed each | `GEMINI_MODEL` is now a fallback list; defaults work with the provided key. Update the list if Google retires them again |
| Last.fm similarity can't bridge genres (journey stayed in metal) | Frontier expansion around waypoints (no help) | Added genre graph + `tag.getTopTracks` bridging |
| Last.fm has no release year / usable artwork | — | Deezer (+ ISRC heuristic) |
| Metallica absent on Deezer from the sandbox | Tried advanced + plain queries | Gradient placeholder art, no preview (not fixable client-side) |
| Screenshots | Playwright + bundled Chromium worked | Real screenshots in `docs/screenshots/`. Animated demo recorded with Playwright video + ffmpeg (`docs/demo.gif`, ~3 MB) |
| `next dev` generated `AGENTS.md` | — | Deleted; not needed |

## 8. Progress

### Done
- Concept, scaffold (Next 16, TS, ESLint, Vitest), `.env.example`, `.gitignore`
- Data layer (Last.fm, Deezer, mock), caching/rate limiting
- Ranking + vibe controls, journey planner (genre route), grounded LLM explanations (Gemini → Groq → template)
- Full UI: hero, autocomplete combobox, results with art/previews/why, vibe panel, journey timeline with streamed progress, mini player, library drawer (localStorage), share-card modal (PNG download / Web Share), mobile layout
- 49 unit/integration tests; typecheck, lint and production build pass
- README with real screenshots, animated GIF + Mermaid diagram
- Round 2: seed-artist cap + "More from this artist" row, shareable playlist links, optional Upstash/Vercel KV cache tier, demo GIF

### In progress
- —

### Next / Roadmap
- MusicBrainz lazy enrichment for exact first-release dates
- Multi-seed "taste mix"; export to other services
- Playwright e2e smoke test in CI
