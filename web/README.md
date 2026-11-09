# Paper Gen (Next.js)

Upload a university past paper and suggested solution. The app generates a close-variant paper and a matching worked solution via OpenRouter (server-side only).

## Start and stop (when you choose)

In a terminal, from the `web` folder:

```bash
./start.sh          # only you, http://localhost:3000
```

Press **Control+C** in that terminal to stop, or run:

```bash
./stop.sh
```

To share a temporary public link with your professor (keep your Mac awake):

```bash
./start-share.sh
```

Then send them the `https://....trycloudflare.com` line that appears. `./stop.sh` turns that link off too.

## Environment variables

In `web/.env.local`:

- `OPENROUTER_API_KEY` (required)
- `OPENROUTER_MODEL` (optional, default `deepseek/deepseek-chat`)
