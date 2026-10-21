# Ports of the Future

A facilitated, in-person **climate-resilience workshop for ports**. One
facilitator drives a projected control centre; participants join from their
phones with a QR code, assess how ready their port is (the PAR Index), buy
adaptation measures on a budget, face a weather "roulette", and debrief luck
vs strategy.

Monorepo:

```
frontend/   React + Vite (participants, facilitators, public landing) — Vercel
backend/    Node + Express + Mongoose + Socket.io — Railway (MongoDB Atlas)
```

## Run locally

```bash
# backend (needs MongoDB running / MONGODB_URI set)
cd backend && npm install && node index.js      # http://localhost:5000

# frontend
cd frontend && npm install && npm run dev        # http://localhost:5173
```

Backend tests: `cd backend && npm test`.

## Documentation

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full picture —
models, REST + socket API, phases, the scoring engine, the secret-data rule,
environment variables, and migration notes.
