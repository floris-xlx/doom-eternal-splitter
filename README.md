Monorepo structure

- apps/web: Next.js app serving charts and API
- apps/collector: Python collector writing to `data/matches.json`
- data/: shared data file consumed by API

Commands

- pnpm -w install
- pnpm dev:web



start web server first:
pnpm dev:web

start collector server:
cd apps/collector
python main.py
