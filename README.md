# ZIWO Ops Dashboards

Small local web apps (Python `http.server` backend + vanilla JS front-end) that wrap the ZIWO Admin API for support engineers: a support dashboard (agents, DIDs, queues, smart routing), an agents dashboard, a client-side admin SPA, and an access-token generator.

`admin-spa/` and `token-generator/` keep their original commit history (they started as the separate repos `ziwo-automation` and `ziwo-token-generator`).

> Sanitized extract of internal tooling: credentials, customer names, hostnames and IPs have been removed or replaced with environment variables. Nothing here contains production data.

Scripts written between **Feb 2026** and **Jul 2026**; git history preserves each file's original date.

## Setup

```bash
cp .env.example .env   # then edit
set -a; source .env; set +a
```

Most scripts prompt interactively for the instance name and password (passwords are never stored); run any script with `-h` where supported.

## Contents

### `admin-spa/`

| Script | What it does | Since |
|---|---|---|
| [`API_REFERENCE.md`](admin-spa/API_REFERENCE.md) | ZIWO Admin API endpoints used by the SPA | 2026-02 |
| [`IMPLEMENTATION_GUIDE.md`](admin-spa/IMPLEMENTATION_GUIDE.md) | How the SPA is structured (services, views, session) | 2026-02 |
| [`README.md`](admin-spa/README.md) | Client-side admin SPA: browse/export agents, numbers and queues | 2026-02 |

### `agents-dashboard/`

| Script | What it does | Since |
|---|---|---|
| [`server.py`](agents-dashboard/server.py) | Agents dashboard: live table of agents with filters and CSV export | 2026-07 |

### `support-dashboard/`

| Script | What it does | Since |
|---|---|---|
| [`server.py`](support-dashboard/server.py) | Support dashboard: agents, DIDs, queues and smart routing in one local web UI (BGW tab needs an external discovery script, not included) | 2026-07 |

### `token-generator/`

| Script | What it does | Since |
|---|---|---|
| [`script.js`](token-generator/script.js) | Static page: log in to an instance, get an API access token, and list/export agents | 2026-02 |

## Disclaimer

Provided as-is for reference. Test against a non-production instance first — several scripts create, update or delete records in bulk.
