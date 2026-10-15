# Bhagesh Hunakunti · portfolio

A single-page static site: plain HTML, CSS and a little JavaScript. There is no build step and no framework. The page makes no requests to other servers.

```
index.html                    the page
css/style.css                 all styles (design tokens at the top)
js/main.js                    theme toggle, nav highlight, tool logos, A/T/G/C background
img/                          portrait, tool logos, favicons, share card
fonts/                        Bricolage Grotesque + IBM Plex Mono (SIL OFL, see LICENSE-OFL.txt)
.github/workflows/deploy.yml  deploys to GitHub Pages
```

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push this folder to a GitHub repository, with `main` as the default branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` runs **Deploy to GitHub Pages**. You can also start it from the Actions tab.

The workflow does four things:

1. It checks that every file the page references exists, and fails before anything goes live if one is missing.
2. It copies only `index.html`, `css/`, `js/`, `img/` and `fonts/` into the build. `README.md` and `metadata.md` are never published.
3. It rewrites the share image (`og:image`) to an absolute URL on your Pages address, which link previews need.
4. It publishes the build to GitHub Pages.

## What's on the page

- **Hero:** name, role and a one-line bio. Beside it is the portrait: the background was removed, and the photo sits in an orange hex sticker with the head breaking out of the top.
- **Stuff I built:** the hex logos of cyRAVEN, FALCONAge, sourcelens and the statistics course.
  - On a wide screen, pointing at a logo extends its orange background into a label with a one-liner and Docs/Source buttons, while the other logos shrink aside.
  - On a phone, a tap opens the logo across the top row, and the others line up beneath it.
  - Keyboard focus opens a logo too.
- **Find me here:** GitHub, LinkedIn, Google Scholar, YouTube and Substack, using their official marks (from Simple Icons, CC0) in the logo orange.
- **Background:** hexagons with a white A, T, G or C light up and fade across the page, and around the cursor or finger. A fresh letter appears each time a cell fades in. The fill color shows the base: A orange, T navy, G gold, C ink.
  - Cells only appear in empty space, never under text, buttons, logos, the header or the phone menu.
  - Over everything sits a light paper grain and a subtle moving film grain.
- **Themes and motion:** light and dark themes follow the system and can be switched. With reduced motion turned on, everything holds still.

## Phones

- Mobile-first CSS, with a floating section menu at the bottom on phones.
- Layout respects notch and home-bar safe areas.
- Tap targets are at least 36 px; most are 44 px.
- Text sizes scale with the screen and still work at 200% zoom.
- Hover effects only apply on devices with a mouse.
- The portrait loads first, in AVIF/WebP sized to the screen.

Tested in headless Chrome at 320 to 1440 px, in both themes: no sideways scrolling, and no background cell overlapping any text or element.
