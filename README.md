# BhuMap — drone + rover land survey

**Team Nostromo · Sri Krishna College of Engineering and Technology (SKCET) · Team ID 178681**
**Smart India Hackathon 2026 · Problem Statement SIH26010**

> **Survey/Resurvey of Rural Agricultural Land in India**
> Theme: Agriculture, FoodTech & Rural Development · Category: Hardware

## The idea

Rural land records in India are still largely based on chain-and-tape surveys, some a century old. Families have divided land and moved bunds since, and maps, Records of Rights, mutation and registration data rarely agree. That mismatch feeds long boundary disputes.

**BhuMap: drone speed with rover-grade legal accuracy.** An RTK drone maps the whole village in one sortie. An RTK rover measures the doubtful boundaries to the centimetre. The owner and the revenue official verify each boundary on site, and every parcel gets a geo-referenced ID linked to its land record the same day.

1. **Aerial capture:** an RTK drone flies at 80–100 m, about 2–3 cm per pixel.
2. **Ground truth:** the rover logs cm-level points where the boundary is in doubt.
3. **Verify:** the owner and the official sign off on a tablet, offline if needed.
4. **Sync:** the parcel and its RoR are linked in a PostGIS GIS layer.

Target metrics (to be replaced with pilot data): **2–5 cm** boundary accuracy, **1** unique parcel ID, a village surveyed in **days**.

## What's on the site

| Page | File | What you'll find |
|---|---|---|
| **Overview** `/` | `index.html` | The problem, a live animation of a drone surveying a village, how BhuMap works, a before/after slider (chain-and-tape record vs BhuMap), impact, deployment domains, the team |
| **The system** `/bhumap` | `bhumap.html` | The five-layer data model (interactive), the technical approach, the pipeline, the field workflow, a comparison with chain-and-tape and drone-only mapping, research |
| **Hardware** `/hardware` | `hardware.html` | Interactive 3D drone and rover with numbered parts, CAD renders, the field kit, the build plan and the roadmap |

The village on the site is **illustrative**: it's generated in code to show the idea, not survey data.

**Code map:**
- `site.js`: shared behaviour (menu, page turns, section jumps, problem-statement popup).
- `map.js`: the generated village, the survey animation and the before/after slider (canvas 2D).
- `system.js`: the isometric layer stack.
- `models3d.js`: a tiny flat-shaded 3D renderer and the drone and rover models (no libraries).
- `styles.css`: the survey-sheet theme.

It's a plain HTML/CSS/JS site with no build step and no dependencies apart from Google Fonts.

## Team Nostromo

| Name | Year & branch |
|---|---|
| [Hariz Rahman](https://www.linkedin.com/in/hariz-rahman-6203bb330/) | III Year · B.E. EEE |
| [Rohit R](https://www.linkedin.com/in/rohit-r-14b371326/) | III Year · B.E. EEE |
| [Jyothi Anu Raagga](https://www.linkedin.com/in/jyothi-anu-raagga-443ba921a/) | III Year · B.E. CSE |
| [Sarveshvar S](https://www.linkedin.com/in/sarveshvar-s-218715277/) | III Year · B.Tech IT |
| [Muthu Ezhil M](https://www.linkedin.com/in/muthu-ezhil-929463276/) | IV Year · B.E. EEE |
| [Pubeshvaran S G](https://www.linkedin.com/in/pubeshvaran-s-g-9a26b7318/) | IV Year · B.E. EEE |

<details>
<summary><b>Run it locally / deploy</b></summary>

```bash
npx serve .          # or: python -m http.server  (then open /bhumap.html, since clean URLs are a Vercel feature)
```

Vercel: import the repo, Framework Preset **Other**, no build command.

</details>
