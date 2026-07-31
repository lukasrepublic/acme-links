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

## The governed history (checkpoints)

Each tutorial step ends at a tagged, checkout-able commit:

| Tag | What it proves |
|---|---|
| `step-1` | The scaffold builds and serves: app skeleton, Drizzle schema, design tokens. |
| `step-5` | `resolve-redirect` merged **after RED → GREEN** — the stub was blocked, the fix admitted. |
| `step-6` | `auth`, `create-link`, `dashboard` merged in the autonomous wave; the full app builds. |
| `step-7` | [`.foundry/build-provenance.yaml`](.foundry/build-provenance.yaml) pins every merged atom to its frozen, operator-authorized contract. |

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
