# Running Distill with Docker — step by step

## What Docker actually does here (in plain English)

- **Image** = a frozen recipe: "install Node, copy this code, run this command."
- **Container** = a running copy of that image — like a tiny, isolated computer.
- **docker-compose.yml** = a list of containers to build and start together,
  so you type one command instead of several.

Your project needs two containers:

```mermaid
flowchart LR
    Browser["Your browser<br/>localhost:5500"] -->|loads HTML/CSS/JS| Frontend["frontend container<br/>(nginx, port 80 → 5500)"]
    Browser -->|fetch() calls| Backend["backend container<br/>(Node/Express, port 5000)"]
    Backend -->|SQL over the internet| Neon[("Neon PostgreSQL<br/>(cloud — not in Docker)")]
    Backend -->|API calls| Gemini["Gemini API"]
    Backend -->|API calls| PH["Product Hunt API"]
```

Notice Neon is **not** a container — it's your existing cloud database.
The backend container just needs the internet and your connection string
to reach it, exactly like when you run `node server.js` without Docker.

## 1. Files to add to your project

Add these six files in the exact locations shown (all provided in the zip):

```
distill/
├── docker-compose.yml          ← NEW, project root
├── Dockerfile.frontend         ← NEW, project root
├── .dockerignore               ← NEW, project root
└── backend/
    ├── Dockerfile               ← NEW
    ├── .dockerignore            ← NEW
    └── .env.example             ← NEW (copy it, see step 2)
```

Nothing else in your project changes — no code was touched.

## 2. Create your real `.env` file

Docker needs your real secrets (database URL, JWT secret, API keys) at
**run time**, not baked into the image. Copy the template and fill it in:

```bash
cp backend/.env.example backend/.env
```

Then open `backend/.env` and fill in:
- `DATABASE_URL` — from your Neon dashboard → your project → Connection string
- `JWT_SECRET` — any long random string (`openssl rand -hex 32` generates one)
- `GEMINI_API_KEY` — your Gemini key
- `PRODUCT_HUNT_TOKEN` — your Product Hunt token

`backend/.env` is already excluded by `.gitignore` and `.dockerignore`, so
it won't be committed or copied into any image.

## 3. Build the images

From the project root (the folder with `docker-compose.yml` in it):

```bash
docker compose build
```

This reads both Dockerfiles and builds the `frontend` and `backend`
images. The first build takes a minute or two (downloading Node/nginx
base images and installing npm packages); later rebuilds are much faster.

## 4. Start everything

```bash
docker compose up
```

You'll see logs from both containers interleaved in your terminal
(`backend  |  Server running on port 5000`, etc.). Leave this running.

To run it in the background instead: `docker compose up -d`

## 5. Open the app

- Frontend: **http://localhost:5500**
- Backend API health check: **http://localhost:5000** (should show
  `Distill Backend API is running`)

The frontend's JS files call `http://localhost:5000/api/...` directly —
that's unchanged, so login, search, and ratings all work the same as
your non-Docker setup.

## 6. Stop everything

```bash
docker compose down
```

This stops and removes the containers (your code and `.env` file are
untouched — they live on your computer, not inside the container).

## Everyday workflow after this is set up

| You changed...              | What to run                          |
|------------------------------|---------------------------------------|
| an `.html`/`.css`/`.js` file | `docker compose up -d --build frontend` |
| a backend `.js` file         | `docker compose up -d --build backend`  |
| `backend/package.json`       | `docker compose build backend` then `up` |

## Troubleshooting

**"Cannot find module 'bcrypt'" or a native build error during `docker compose build`**
`backend/package.json` lists both `bcrypt` and `bcryptjs`, but the code only
uses `bcryptjs` (a pure-JS version — this was the fix for the Windows native-binding
issue). If the `bcrypt` package ever fails to install in the image, add this
line to `backend/Dockerfile` right before `RUN npm install`:
```dockerfile
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*
```

**Live pricing scraping (`priceFetcher.js`, uses Playwright) fails at runtime**
The base image doesn't include a Chromium browser. This only matters if that
specific feature is actually triggered. To support it, replace the first
line of `backend/Dockerfile` with:
```dockerfile
FROM mcr.microsoft.com/playwright:v1.63.0-jammy
```
(this image already has Chromium and its system dependencies installed).

**Backend can't reach Neon / "DATABASE_URL is missing from .env"**
Means `backend/.env` wasn't found or wasn't filled in — check step 2, and
confirm `docker-compose.yml`'s `env_file: ./backend/.env` path is correct.

**Neon says the database is "idle" / connection is slow the first time**
That's Neon's free-tier auto-pause waking up — normal, just retry after a
few seconds (matches the pause issue already noted for this project).

**Port already in use (5000 or 5500)**
Something else on your machine is using that port. Change the left-hand
number in `docker-compose.yml`'s `ports:` (e.g. `"5001:5000"`), but remember
the frontend JS is hardcoded to call `localhost:5000` — if you change the
backend's host port, update those `API_BASE`/`TOOLS_API`/etc. constants in
the `js/` files to match.
