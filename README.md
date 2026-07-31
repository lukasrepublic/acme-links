# Acme Links

A link shortener with accounts — and the worked example for
[**Agentic Foundry**](https://github.com/lukasrepublic/agentic-foundry). This repo was built
from an empty directory to a governed, live-proven merge by following the
[7-step tutorial](https://github.com/lukasrepublic/agentic-handbook/blob/main/docs/tutorial/README.md)
in the [`agentic-handbook`](https://github.com/lukasrepublic/agentic-handbook) template — the
specs, acceptance contracts, design system, and every prompt used live there, under
[`specs/features/acme-links/`](https://github.com/lukasrepublic/agentic-handbook/tree/main/specs/features/acme-links).

> **The one idea.** A green checkmark — "it compiled, the PR is ready" — does not mean the
> feature works. The contract journeys in [`tests/journeys/`](tests/journeys) drive the
> *running* app at the seams the acceptance contracts name, and CI refuses the merge while
> they're red. This repo's own history proves it: the `resolve-redirect` PR first shipped a
> deliberately stubbed seam (`GET /r/:slug` → `200 'ok'`), the journey went RED and the merge
> was blocked; the fix (real DB lookup + atomic `clicks++` + `302`) turned the same check
> GREEN. `status ≠ functional`, proven by machine.

## What it does

Signed-in users create short links (`/r/<slug>` → a long URL) and see per-link click counts
on a dashboard; anyone can follow a short link. Auth + DB + UI — every surface a merge gate
cares about, in the smallest honest footprint.

**Stack:** Next.js (App Router) + TypeScript · Postgres + Drizzle · Better Auth
(email+password) · Tailwind v4 `@theme` tokens + owned components (designed in Claude Design).

## Run it

Prereqs: Node ≥ 22, Docker.

```bash
cp .env.example .env      # set BETTER_AUTH_SECRET (openssl rand -base64 32)
make install              # npm install
make db-up                # local Postgres 16 on :5433 (docker)
make db-push              # create the schema
make dev                  # http://localhost:3000
```

Run the contract journeys against a built app:

```bash
make build && make journeys          # all four atoms' journeys
npx playwright test --grep AC-RESOLVE-1   # just the money-shot checkpoint
```

## How it was built

[**The full build journey**](https://github.com/lukasrepublic/agentic-handbook/blob/main/docs/BUILD-JOURNEY.md)
— every command and prompt that produced this repo, in order: workspace setup, requirements,
audits, the operator freeze, buildout, security review, the merge floor, and the provenance pin.
Including what went wrong.

## The governed history (checkpoints)

Each tutorial step ends at a tagged, checkout-able commit:

| Tag | What it proves |
|---|---|
| `step-1` | The scaffold builds and serves: app skeleton, Drizzle schema, design tokens. |
| `step-5` | `resolve-redirect` merged **after RED → GREEN** — the stub was blocked, the fix admitted. |
| `step-6` | `auth`, `create-link`, `dashboard` merged in the autonomous wave; the full app builds. |
| `step-7` | [`.foundry/build-provenance.yaml`](.foundry/build-provenance.yaml) pins every merged atom to its frozen, operator-authorized contract. |

## Running it somewhere real

This is a teaching exhibit, and it is honest about what that means. Before you put
it on the internet:

- **TLS is required off localhost.** Session cookies are issued `Secure`, and browsers
  only treat `localhost` as a trustworthy origin. Served over plain HTTP on any other
  host, the browser drops the cookie and login silently does nothing.
- **`BETTER_AUTH_SECRET` must be set.** The app refuses to start without it rather than
  falling back to a library default that everyone can read.
- **The rate limiter is in-memory and per process** — honest for one instance, not for a
  fleet. It deliberately ignores `x-forwarded-for` (a client can set that header to
  anything, so keying on it would hand an attacker unlimited guesses); set
  `TRUST_PROXY=1` only when a proxy *you control* overwrites the header.
- **Signup is not flood-limited, and a duplicate signup returns `409`** — which is an
  account-enumeration oracle. Both are deliberate: the 409 is what the acceptance
  contract specifies because it makes the tutorial's behavior legible. The
  industry alternative is a generic `200` plus a confirmation email; that is the right
  choice for a production signup and the wrong one for a worked example.
- **Sessions are not revoked in bulk.** A new login mints a new token, but existing
  sessions live out their 7 days; there is no "log out everywhere" and no eviction on
  password change.

## Layout

```
src/
├── app/
│   ├── (auth)/            login, signup, logout — session auth (Better Auth)
│   ├── api/
│   │   ├── links/         POST /api/links — create a short link
│   │   └── me/            GET /api/me — the auth-required probe surface
│   ├── dashboard/         your links + click counts (design-system UI)
│   └── r/[slug]/          GET /r/:slug — the redirect seam (the money shot)
├── db/                    Drizzle schema + client (user/session/account · link)
├── design-system/         @theme tokens + owned components (the compiled design WHAT)
└── lib/                   auth wiring · slug + URL policy
tests/journeys/            the contract journeys, named by AC-ID
```

## License

[MIT](LICENSE)
