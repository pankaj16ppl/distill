# backend/Dockerfile
# ------------------------------------------------------------
# This builds an "image" — a snapshot of everything the backend
# needs to run (Node.js itself, your npm packages, and your code).
# Docker then starts a "container" from that image — a running
# copy of it, isolated from your actual computer.
# ------------------------------------------------------------

# 1. Start from an official Node.js 20 image (small "slim" version).
#    This already has Node and npm installed — we don't install them ourselves.
FROM node:20-slim

# 2. Every command below runs inside /app inside the container.
#    This is like doing "cd /app" before every following step.
WORKDIR /app

# 3. Copy ONLY the two package files first (not all the code yet).
#    Docker caches each step: if package.json hasn't changed, it will
#    reuse the cached "npm install" instead of redoing it — much faster
#    rebuilds while you're only editing your own .js files.
COPY package*.json ./

# 4. Install the dependencies listed in package.json (express, pg, etc.)
#    --omit=dev skips devDependencies, which this project doesn't use anyway.
RUN npm install --omit=dev

# 5. Now copy the rest of the backend code (controllers, routes, models...).
COPY . .

# 6. Documents which port the app listens on (server.js reads PORT, default 5000).
#    This line is informational for humans/tools; it doesn't publish the port —
#    that happens in docker-compose.yml.
EXPOSE 5000

# 7. The command that runs when the container starts.
CMD ["node", "server.js"]
