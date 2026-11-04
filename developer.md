# Similar Song AI — developer notes

> Living document. A new session should be able to continue from the **Progress** section.

## Progress

### Done
- Concept + architecture (below), Next.js 16 / TypeScript scaffold, lint/typecheck/vitest wired up
- Data layer: Last.fm (tags, similarity), Deezer (search, artwork, previews, year), mock data source, TTL caching + rate limiting
- Ranking engine with vibe controls (popularity, era, energy, moods) and journey planner (unit-tested)
- LLM abstraction (Gemini + Groq) with grounded "why it's similar" explanations and a template fallback
- API routes: search, similar, explain, journey (NDJSON stream), enrich, preview, img proxy, status

### In progress
- Frontend (Apple-Music-inspired glass UI)

### Next
- Playlists (localStorage), share-card image, README screenshots, deploy notes, PR

## Decisions
- **Branch**: the task asked for `claude/v1`; the harness also assigned `claude/similar-song-ai-v1-6q2c4g`. Work happens on `claude/v1` and is mirrored to the assigned branch at each checkpoint.
