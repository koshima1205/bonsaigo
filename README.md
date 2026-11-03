# Engawa — the bonsai veranda

A bonsai media site where owners abroad ask masters in Japan, and the masters' words cross the sea without breaking. The owner writes in their own language; the master answers in Japanese by voice, by drawing on the photo, or by tapping stock phrases. Claude carries the words across. It never answers in the master's place.

Built for **Built with Claude: Japan 2026** (2026-11-02 – 11-08). Everything in this repository was written during the hackathon.

## Two things to see first
1. **Words that cross the sea unbroken.** Bonsai words and dialect break when translated literally. 「軒下になおしてください」 becomes "repair it under the eaves", and 「木がえらそう」 becomes "the tree looks great". Engawa translates through a glossary that the masters themselves correct, so these come out as *move it under the eaves* and *the tree looks weak*. Before sending, the master reads a back-translation of every line, next to their own words quoted verbatim.
2. **One consultation becomes media.** Consultation → answers from several masters → an article in five languages → a vertical short video → captions for Instagram, YouTube and TikTok. The master presses OK at each step. Nothing is ever posted automatically.

## Everything inside
| # | Feature | Where |
|---|---|---|
| 1 | Ask a master (photos + question, AI asks only what a master needs) | `/#/ask` |
| 2 | Glossary with literal vs. meaning, dialect included; grows every time a master corrects it | `/#/glossary`, master: `/#/master/glossary` |
| 3 | Several masters answer; AI lines up their answers by axis (diagnosis, placement, water…) | `/#/c/:id` |
| 4 | Articles in Japanese, easy Japanese, English, Spanish and Chinese | `/#/read` |
| 5 | Short-video drafts (canvas, exportable as .webm) and per-platform captions; the master approves; no auto-posting | `/#/shorts`, master: `/#/master/short/:id` |
| 6 | Visits measured per short and per platform through tracking links (`?src=s-xxx-ig`) | master: `/#/studio` |
| 7 | Board for owners and masters, with translation | `/#/board` |
| 8 | AI help desk before the masters (glossary + articles), handing off to a master when it is about your own tree | `/#/help` |
| 9 | Wish list: owners describe a tree, masters raise a hand (matching only, no payment or shipping) | `/#/wish` |
| 10 | UI per person: large text for masters, the owner's own language for owners | `/#/master` |

The background music is generated in the browser with the Web Audio API (koto, shakuhachi, wind, shishi-odoshi). No recorded or copyrighted audio is used.

## How Claude is used
- **Intake**: reads the photos and question, asks only what a master would need, and turns the owner's climate into a Japanese equivalent.
- **Brief**: writes a three-line summary in plain Japanese for the master.
- **Letter**: turns the master's words into a care letter in the owner's language, with glossary meanings, never literal ones. Every line quotes the master's original; the server checks that each quote really appears in what the master said.
- **Knowledge**: lines up several masters' answers by axis and notes where they agree or differ.
- **Article / Short / Help / Wish / Translate**: each is a structured output.

Claude never gives care advice of its own. Model: `claude-opus-5-5` with structured outputs and server-side fallback.

## Run locally
```bash
npm install
cp .dev.vars.example .dev.vars   # ANTHROPIC_API_KEY and MASTER_CODE
npm run dev
```
Without an API key, every screen runs on sample replies (marked as samples), so you can click through everything. Seeded data (sample masters "A" and "B", sample numbers) is fictional and labelled as a sample.

`MASTER_CODE` protects the masters' screens and APIs. If it is not set, they stay locked.

## Stack
Cloudflare Workers + static assets, Workers KV, Anthropic TypeScript SDK, browser speech recognition, canvas + MediaRecorder for shorts, Web Audio for music.
