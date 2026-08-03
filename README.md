# v1tor.com

A single-screen personal site — black-and-white portrait backdrop, the sigil
mark, and three links that preview themselves on hover.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:1408
```

## What's on the page

| Piece | Behaviour |
| --- | --- |
| **Entrance** | A black curtain lifts, the backdrop settles in from a slow push-in, and each element rises with a staggered blur-to-sharp fade. |
| **Sigil** | Hovering spins it a full turn on a smooth ease and kicks up a canvas dust plume from its base. |
| **Social icons** | Same spin-and-dust, scaled down to icon size. |
| **GitHub hover** | Live profile card — avatar, bio, location, repo/follower counts — pulled from the public GitHub API. |
| **LinkedIn hover** | Profile card rendered from local config (see below). |
| **Spotify hover** | What's playing right now, with a live progress bar; falls back to the last played track. |

Everything respects `prefers-reduced-motion`.

## Configuration

Name, role, location and links live in [`src/lib/site.ts`](src/lib/site.ts).

### GitHub

Works with no setup — the public API is called at build time and revalidated
hourly. Setting `GITHUB_TOKEN` in `.env.local` only raises the rate limit.

### LinkedIn

LinkedIn has **no public profile API** and blocks unauthenticated requests
(every fetch returns HTTP 999), so this card cannot be fetched live. Its
contents come from `LINKEDIN_PROFILE` in [`src/lib/site.ts`](src/lib/site.ts) —
edit the headline and connection count there to match the real profile.

### Spotify

The "now playing" card needs a one-time OAuth handshake:

1. Create an app at <https://developer.spotify.com/dashboard>
2. Add `http://127.0.0.1:8888/callback` as a Redirect URI
3. Run:

   ```bash
   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy pnpm spotify:auth
   ```

4. Paste the three printed values into `.env.local` (see `.env.example`)

Without them the card still renders, showing a "not connected" state. On Vercel,
add the same three variables to the project's environment settings.

## Assets

`public/background.png` (portrait) and `public/sigil.png` (mark) are the source
images. The sigil is black on transparent and is inverted in CSS to render bone
white. `src/app/icon.png` is the favicon.

## Previous site

The former template lives in `legacy/` (git-ignored). It was already missing
`tsconfig.json`, `postcss.config.mjs` and several `src/lib` modules, so it no
longer built; it is kept only for reference and can be deleted.
