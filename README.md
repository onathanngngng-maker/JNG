# Paper Gen

Production Next.js app: upload a university past paper and suggested solution, generate a close-variant paper plus matching solutions.

The app lives in `web/`.

```bash
cd web
export PATH="/Users/chunheing/Projects/paper-gen/.conda/bin:$PATH"
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required: `OPENROUTER_API_KEY` in `web/.env.local`.
