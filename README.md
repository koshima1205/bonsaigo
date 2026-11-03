# Engawa

Bonsai owners abroad ask a bonsai master in Japan. The owner writes in their language; the master answers in Japanese by voice, by drawing on the photo, or by tapping stock phrases. Claude carries the words across — it never answers in the master's place.

Built for **Built with Claude: Japan 2026** (2026-11-02 – 11-08). Everything in this repository was written during the hackathon.

## What Claude does
1. **Intake** — looks at the photos and the question and asks the owner only what a master would need (indoors or outdoors, last repotting…). It also turns the owner's local climate into a Japanese equivalent ("like November in Tohoku").
2. **Brief** — writes a three-line summary in plain Japanese for the master.
3. **Letter** — turns the master's spoken words into a care letter in the owner's language. Every line quotes the master's original Japanese, and the server checks that each quote really appears in what the master said. The master sees a back-translation before sending, plus anything Claude found ambiguous.

Claude never gives care advice of its own. Model: `claude-opus-5-5` with structured outputs and server-side fallback.

## Run locally
```bash
npm install
cp .dev.vars.example .dev.vars   # put your ANTHROPIC_API_KEY here
npm run dev                       # http://localhost:8787
```
Without a key the app runs with sample replies, so you can still click through every screen.

- Owner: `/#/ask`
- Master: `/#/master` (asks for `MASTER_CODE` when one is set)

## Stack
Cloudflare Workers + static assets, Workers KV (consultations kept 30 days), Anthropic TypeScript SDK, browser speech recognition and speech synthesis.
