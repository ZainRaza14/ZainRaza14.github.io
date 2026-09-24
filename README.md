# zainraza14.github.io

Personal website of **Syed Zain Raza** — polymath operating at the intersection of technology, strategy, and revenue.

**Live site:** [zainraza14.github.io](https://zainraza14.github.io)

## What's Inside

A fully static site, hand-built and dependency-light: no frameworks and no build step to deploy — just HTML, CSS, and vanilla JavaScript served by GitHub Pages. It spans written essays, deep technical writing, and playable browser games.

| Section | What it is |
|---|---|
| [AI Engineering](https://zainraza14.github.io/Tech/allTech.html) | Building AI products, the business & engineering decisions behind them, and the foundations they stand on |
| [Reinforcement Learning](https://zainraza14.github.io/rL.html) | RL theory from eligibility traces to RLHF, plus RL and memory |
| [Game Design](https://zainraza14.github.io/gamedesign.html) | Game reviews, design theory, and technical deep dives (NPC AI, pathfinding, rendering) |
| [Stochastic Thinking](https://zainraza14.github.io/stochastic.html) | Essays on philosophy, mindset, and life |
| [Interactive Space](https://zainraza14.github.io/interactive.html) | Playable browser games, each built around a single mechanic |
| [Spiritual Space](https://zainraza14.github.io/spiritual.html) | Interactive stories rooted in faith, told with reverence |

## AI Engineering

The largest section, organized as a hub with eight sub-sections that move from product and strategy down to fundamentals:

- **AI Products** — from demo to product, UX for non-deterministic systems, where the moat really is, and a 0-to-1 first-feature playbook
- **AI Decisions** — should this even use AI, choosing a model, build vs buy vs fine-tune, and the real cost of an AI feature
- **LLMs & AI Engineering** — prompting, RAG, agents, fine-tuning, evaluation, and cost control for AI in production
- **Deep Learning** — neural networks, CNNs, RNNs/LSTMs, and Transformers from first principles
- **Machine Learning** — core concepts and interview prep
- **AI & GTM Systems** — AI for RevOps, AI-personalized landing pages, lead routing, Flow vs Apex, data hygiene, attribution, API limits, and buy vs build
- **Python** and **Big Data** — the everyday tooling and data plumbing beneath the AI work

## Interactive Space (browser games)

Self-contained games written in vanilla JavaScript with canvas rendering, zero dependencies, keyboard + touch controls, and localStorage persistence:

- **Journey to the Light** — a side-scrolling platformer with free movement, a following camera, a savanna-sunset color arc, cosmetic unlocks, and synthesized audio (organized as modular `game.js` / `player.js` / `obstacles.js` / `ui.js` / `audio.js`)
- **Lightkeeper** — a survival game about steadfastness: standing firm with your lantern burns away the dark
- **Orbit** — a one-button game of gravity and timing, with particles, a parallax starfield, and procedural levels

## Spiritual Space

Reverent, non-violent interactive stories:

- **The Night of the Cloak** — a children's story of Hadith al-Kisa told through choices, with the blessed family shown only as light
- **The Lantern of Sabr** — a cinematic scene of patience through a long night, with a full post-processing pipeline (bloom, god-rays, fog, film grade, letterbox)

## Highlights

- **AI Products & AI Decisions** — eight essays on shipping AI and the calls behind it, written from a builder's and a business perspective.
- **Cinematic canvas rendering** — The Lantern of Sabr runs a real post-processing pipeline (offscreen buffers, bloom, volumetric god-rays, film grain, color grade) entirely in a single HTML file.
- **Deep learning & RL from first principles** — neural nets, CNNs, LSTMs, Transformers, and RL-with-memory explained with working code, not just diagrams.

## Stack

- **Hosting:** GitHub Pages
- **Base theme:** [Clean Blog](https://startbootstrap.com/theme/clean-blog) by Start Bootstrap, heavily customized
- **CSS:** Bootstrap 3 + a custom design layer (card system, timelines, tag pills, contact cards)
- **JS:** jQuery for the theme; pure vanilla JS + Canvas for the games; Web Audio for game sound
- **Fonts:** Lora + Open Sans (Trebuchet MS in the games)

## Structure

```
├── index.html            # Home — section cards
├── about.html            # Bio, expertise, timeline, favorite games & books
├── blogs.html            # Blog section index (mirrors the home cards)
├── interactive.html      # Playable games listing
├── spiritual.html        # Faith-based interactive stories listing
├── stochastic.html       # Philosophy & mindset essays index
├── rL.html               # Reinforcement learning index
├── gamedesign.html       # Game design posts index
├── games/                # Self-contained canvas games
│   ├── journey/          #   Journey to the Light (modular JS)
│   ├── lightkeeper.html  #   Lightkeeper
│   ├── orbit.html        #   Orbit
│   ├── kisa.html         #   The Night of the Cloak
│   └── lanternofsabr.html#   The Lantern of Sabr
├── RL/                   # Reinforcement learning posts
├── videoGames/           # Game design posts & reviews
├── stochastic/           # Philosophy & mindset essays
├── Tech/                 # AI Engineering hub + sub-sections
│   ├── allTech.html      #   Hub landing page
│   ├── AIProducts/       #   Building & shipping AI products
│   ├── AIDecisions/      #   Business & engineering decisions
│   ├── LLM/              #   LLMs & AI engineering
│   ├── DeepLearning/     #   Deep learning
│   ├── ML/               #   Machine learning
│   ├── GTM/              #   AI & GTM systems
│   ├── Python/           #   Python
│   └── BigData/          #   Big data
├── img/                  # Images and post backgrounds
└── css/                  # Theme + custom design layer
```

## Running Locally

No build required:

```bash
git clone https://github.com/ZainRaza14/ZainRaza14.github.io.git
cd ZainRaza14.github.io
python3 -m http.server 8000
# open http://localhost:8000
```

## Contact

- **LinkedIn:** [syed-zain-raza](https://www.linkedin.com/in/syed-zain-raza-ba96899b)
- **X:** [@zainraza1110](https://x.com/zainraza1110)
- **Email:** zainrazakazmi850@gmail.com

---

© Syed Zain Raza. Content is original unless noted; theme under its original MIT license.
