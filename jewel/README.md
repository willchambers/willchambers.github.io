# Jewel Design System

A minimal, editorial design system in plain HTML, CSS and a little JavaScript. There is no build step.

```
css/
  jewel.css             entry point — the only stylesheet you link
  tokens.css            primitives → theme colours → resolved tokens
  base.css              reset, type scale, links, rules, 12-col grid
  background.css        animated Jewel gradient
  utilities.css         data-text variants, .visually-hidden
  parked/
    light-theme.css     light theme, set aside (not imported)
  components/
    _template.css       starting point for a new component
    button.css  figure.css  footer.css  header.css  index-list.css
    knockout.css  meta-list.css  panel.css  quote.css  tag.css  video.css
js/
  jewel.js              core: Jewel.theme + component registry
  components/
    _template.js        starting point for component behaviour
    theme-toggle.js     (unused while the system is dark-only)
    video.js
index.html              specimen page / usage reference
```

## Setup

```html
<html lang="en" data-theme="dark">
<head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap">
  <link rel="stylesheet" href="css/jewel.css">
  <script src="js/jewel.js" defer></script>
</head>
<body>
  <div class="jewel-bg" aria-hidden="true"></div>
  <div class="jewel-cap" aria-hidden="true"></div>  <!-- hides content in the gap above the header -->
  <div class="page">
    <header class="site-header"><div class="panel site-header__inner">…</div></header>
    <main class="panel-stack">
      <section class="panel panel--pad">…</section>
      <section class="panel panel--pad">…</section>
    </main>
  </div>
</body>
```

Include only the component scripts a page uses.

## Page structure and panel shapes

The page is a floating glass header over a column of content panels, with the gradient showing between them.

| Piece | Class | Shape |
|---|---|---|
| Header | `.site-header` > `.panel.site-header__inner` | Square corners. Sticky; `.jewel-cap` hides content in the gap above it. |
| Panel column | `.panel-stack` | A grid of panels with a `--panel-stack-gap` (16px) gap. |
| Content panel | any `.panel` directly inside `.panel-stack`, or `.panel--content` anywhere | Square top left, 2px top right with the knockout lines, 10px bottom left and right. |
| Other panels | `.panel` | Square on all sides (cards, nested panels). |

**Knockout lines.** Two parallel 45° hairlines are cut through the top-right corner of every content panel, and the background shows through them. They are real holes, made with a CSS mask, so they cut the fill, the border and the blur. Add them to any other element with `.knockout`. Remove them from a content panel with `.no-knockout`.

**Shape tokens** (in `tokens.css`):

```css
--panel-radius: 0;              /* every panel */
--panel-radius-top-right: 2px;  /* content panels: knockout corner */
--panel-radius-bottom: 10px;    /* content panels: bottom corners */
--knockout-offset: 10px;        /* corner → first line */
--knockout-width: 1px;          /* line thickness */
--knockout-gap: 3px;            /* space between the lines */
--sticky-offset: 1rem;          /* gap above the sticky header */
```

To change the shape for one panel only, set a token inline, for example `style="--knockout-offset: 16px"`.

## Attributes

| Attribute | Values | Where |
|---|---|---|
| `data-theme` | `dark` | `<html>`. Dark is the only active theme and is also the default, so this is optional. The attribute stays so that future themes can be scoped to a page or element. |
| `data-panel` | `solid` | Any element. Panels are glass by default. This gives an opaque surface instead, for example over photography. |
| `data-text` | `default`, `muted`, `accent`, `inverse` | Any element. |
| `data-component` | a registered name | Wires up JS behaviour (see below). |
| `data-bg` | `paused` | `<html>`. Stops the background animation. |

## Adding a component

1. **Style.** Copy `css/components/_template.css` to `css/components/<name>.css`. Add one line to `css/jewel.css`:
   ```css
   @import url("components/<name>.css") layer(components);
   ```
2. **Behaviour (only if CSS can't do it).** Copy `js/components/_template.js` to `js/components/<name>.js`. Put `data-component="<name>"` on the root element, and add `<script src="js/components/<name>.js" defer>` after `jewel.js`.
3. **Show it.** Add an example to `index.html` so the specimen stays the reference.

Rules that keep every component working in both themes, including scoped ones:

- **Colour:** use only the resolved tokens: `--panel-bg`, `--panel-border`, `--panel-backdrop`, `--media-bg` and `--text-default|muted|accent|inverse`. Don't use hex values or `--color-*` primitives. Those don't switch between glass and solid, so they would skip the contrast adjustments.
- **Size and motion:** use `--space-*`, `--text-*`, `--radius-*`, `--hairline`, `--duration-*` and `--ease-*`.
- **Naming:** block `.name`, part `.name__part`, variant `.name--variant`.
- **Variants:** give each variant local custom properties rather than new rules. `button.css` works this way: a variant only sets `--btn-bg`, `--btn-fg` and so on.

**Cascade layers.** `jewel.css` declares `tokens → base → background → components → utilities`, and a later layer always wins. Your own page CSS sits outside the layers, so it overrides the system without `!important` or specificity fights.

**JS API.**

```js
Jewel.register('name', (el) => { … });  // runs for each [data-component="name"]
Jewel.mount(container);                  // wire up markup inserted later
Jewel.theme.get() / .set('dark') / .toggle();
document.documentElement.addEventListener('jewel:themechange', e => e.detail);
Jewel.reducedMotion.matches;
```

## Themes

The system is **dark-only** for now. The knockout lines and rounded content-panel corners belong to the dark theme's look.

The light theme is parked in `css/parked/light-theme.css`, which is not imported. It keeps its AA-verified colours. The plan is for it to become a separate direction that has no knockout lines and no rounded corners. The file's header lists the steps to bring it back: import it, switch the dark shape off for light panels, and re-add the toggle.

To add a theme, create a block of `--color-*`, `--glass-*` and `--bg-dim` values under `[data-theme="<name>"]`. Copy the dark block in `tokens.css` as a starting point. Before using it, run its colours through the contrast check below.

## Background tuning

```css
:root {
  --bg-speed: 32s;      /* one full cycle */
  --bg-intensity: 1;    /* 0–1, gradient strength over --bg-base */
  --bg-blur: 0px;       /* extra softening, optional */
}
[data-theme="dark"] { --bg-dim: 0; }  /* 0–1 dark scrim over the gradient, per theme */
```

`--bg-dim` exists for themes whose panels need a darker backdrop to stand out. The parked light theme uses 0.4.

With `prefers-reduced-motion: reduce`, the animation is removed and the registered initial values give a static composition.

## Contrast (WCAG AA, 4.5:1 for body text)

The tables cover both themes. The light rows apply to the parked light theme.

Each pairing below was computed using the WCAG relative-luminance formula. Glass was tested as the fill alpha-blended over the worst-case backdrop. That covers each of the five Jewel colours, a near-white page (#F4F4F5) and a near-black page (#0B0B0E). The near-white and near-black backdrops matter because scoped themes let a dark glass card sit over a light page, and the reverse.

Solid surfaces: everything passes with the specified values.

| | on panel | on muted surface |
|---|---|---|
| Light default / muted / accent | 16.97 / 7.41 / 6.81 | 16.12 / 7.03 / 6.46 |
| Dark default / muted / accent | 17.15 / 7.35 / 10.21 | 15.44 / 6.62 / 9.19 |
| Inverse on default fill / accent fill | light 16.97 / 6.81 · dark 16.12 / 9.60 | |

Glass surfaces with the specified values failed:

| Worst case (spec values) | Ratio |
|---|---|
| Light muted #52525B, glass 0.72 over near-black | 3.86 ✗ |
| Light accent #6D28D9, glass 0.72 over Jewel purple | 4.23 ✗ |
| Dark muted #A1A1AA, glass 0.68 over near-white | 2.70 ✗ |
| Dark accent #C4B5FD, glass 0.68 over near-white | 3.75 ✗ |

**Changes (glass mode only; the solid tokens keep the specified values):**

| Token | Spec | Now | Worst case after |
|---|---|---|---|
| Light glass fill alpha | 0.72 | **0.86** | — |
| Dark glass fill alpha | 0.68 | **0.86** | — |
| Light muted text in glass | #52525B | **#4B4B53** | 6.10 |
| Light accent text in glass | #6D28D9 | **#5B21B6** | 6.34 |
| Dark muted text in glass | #A1A1AA | **#B4B4BD** | 6.32 |
| Dark accent text in glass | #C4B5FD | unchanged | 7.05 |
| Default text in glass | unchanged | | light 12.50 · dark 11.84 |

0.78 was the minimum that passes AA. It was raised to 0.86 so that small and light text (labels, captions) keeps a comfortable margin above 4.5:1.

These values are exposed as `--glass-fill`, `--glass-text-muted` and `--glass-text-accent`. They are the defaults. Under `data-panel="solid"`, the specified solid values apply instead.

The background's `--bg-base` (#7A2E9E) sits inside the Jewel luminance range. Lowering `--bg-intensity` therefore never produces a backdrop worse than the cases tested above.

## Performance notes

- The background is a single fixed layer (`contain: strict`, its own compositing layer). Only registered custom properties animate, and no layout runs. The gradient is repainted each frame, but only inside that isolated layer. This is the cost of interpolating gradient colours.
- In glass mode, `backdrop-filter` has to re-sample the moving background on every frame. That is the most expensive part of the system. If a low-end device struggles, use `data-bg="paused"`, or keep large surfaces `solid` and use glass on small ones such as the header.
