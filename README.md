# zainraza14.github.io

Personal website of **Syed Zain Raza** — polymath operating at the intersection of technology, strategy, and revenue.

**Live site:** [zainraza14.github.io](https://zainraza14.github.io)

## What's Inside

This is a fully static site, hand-built and dependency-light. No frameworks, no build step required to deploy — just HTML, CSS, and vanilla JavaScript served by GitHub Pages.

| Section | What it is |
|---|---|
| [Stochastic Thinking](https://zainraza14.github.io/stochastic.html) | Essays on philosophy, mindset, and life |
| [Game Design](https://zainraza14.github.io/gamedesign.html) | Game reviews, design theory, and technical deep dives (NPC AI, rendering) |
| [Reinforcement Learning](https://zainraza14.github.io/rL.html) | RL theory from eligibility traces to RLHF |
| [Tech Hacks](https://zainraza14.github.io/Tech/allTech.html) | Python, machine learning, deep learning, big data, and GTM systems |
| [Interactive Space](https://zainraza14.github.io/interactive.html) | Playable browser games built around single mechanics |

## Highlights

- **Orbit** — a one-button canvas game of gravity and timing, written in ~400 lines of vanilla JS with zero dependencies. Particle systems, parallax starfield, procedural level generation, and localStorage high scores, all in one self-contained file.
- **GTM Systems essays** — lead routing architecture, Flow vs Apex decision frameworks, attribution model blind spots, and buy-vs-build strategy, drawn from 7+ years building revenue infrastructure.
- **Deep learning from first principles** — neural networks, CNNs, LSTMs, and Transformers explained with working code, not just diagrams.

## Stack

- **Hosting:** GitHub Pages
- **Base theme:** [Clean Blog](https://startbootstrap.com/theme/clean-blog) by Start Bootstrap, heavily customized
- **CSS:** Bootstrap 3 + custom design layer (card system, timelines, tag pills, contact cards)
- **JS:** jQuery for the theme, pure vanilla for the games
- **Fonts:** Lora + Open Sans

## Structure

```
├── index.html            # Home - section cards
├── about.html            # Bio, expertise, timeline, favorite games & books
├── interactive.html      # Playable games listing
├── games/                # Self-contained canvas games (Orbit)
├── stochastic/           # Philosophy & mindset essays
├── videoGames/           # Game design posts & reviews
├── RL/                   # Reinforcement learning posts
├── Tech/                 # Python / ML / DL / Big Data / GTM hacks
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
