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
    knockout.css  meta-list.css  panel.css  quote.css  section-head.css  tag.css  video.css
    field.css  input.css  choice.css  tag-input.css  dropzone.css      forms
    fab.css  sheet.css                                                 posting flow
    lightbox.css  filter.css                                           photos and filtering
js/
  jewel.js              core: Jewel.theme + component registry
  components/
    _template.js        starting point for component behaviour
    theme-toggle.js     (unused while the system is dark-only)
    video.js
    form.js             validation, counters, busy state, Jewel.field helpers (load first)
    tag-input.js  dropzone.js  sheet.js  post-form.js
    lightbox.js  filter.js
index.html              specimen page / usage reference
media/                  small SVG artworks for the specimen's lightbox
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
| Section head | `.section-head` as the first child of a content panel | The numbered label (`01 — Typography`) with a 1px rule under it that runs the full width of the panel, edge to edge. Content below sits in `span-9 start-4`. |
| Other panels | `.panel` | Square on all sides (cards, nested panels). |

**Knockout lines.** Two parallel 45° hairlines are cut through the top-right corner of every content panel, and the background shows through them. They are real holes, made with a CSS mask, so they cut the fill, the border and the blur. Add them to any other element with `.knockout`. Remove them from a content panel with `.no-knockout`.

**Shape tokens** (in `tokens.css`):

```css
--panel-radius: 0;              /* every panel */
--panel-radius-top-right: 2px;  /* content panels: knockout corner */
--panel-radius-bottom: 10px;    /* content panels: bottom corners */
--knockout-offset: 6px;         /* corner → first line */
--knockout-width: 1px;          /* line thickness */
--knockout-gap: 2px;            /* space between the lines */
--sticky-offset: 1rem;          /* gap above the sticky header */
```

To change the shape for one panel only, set a token inline, for example `style="--knockout-offset: 16px"`.

## Forms

Style: **hairline box**, option B of the three explored. Each field is a 1px box with square corners in `--field-border` and a faint `--field-fill`. On focus the box turns accent and doubles to 2px; errors do the same in `--field-error`. Labels are small uppercase text above the field. Load `js/components/form.js` before the other form scripts.

| Component | Markup | Notes |
|---|---|---|
| Form | `form.form[data-component="form"][novalidate]` | Layout: `.form__group` (fieldset with a hairline above), `.form__legend`, `.form__row--2` (two columns from 48rem), `.form__actions`. Messages: `.form__error` (role alert) and `.form__status` (role status). |
| Field | `.field` > `.field__label` + control + `.field__meta` (`.field__hint`, `.field__counter`) + `.field__error` | `.field__req` marks required. `.field__optional` for "(optional)". `.field__badge` shows "Suggested". |
| Input | `input.input`, `textarea.input`, `.select > select.input` | The textarea grows with its content. The select is native, restyled with a hairline chevron. |
| Choice | `label.choice > input[type=checkbox\|radio]` | Add `role="switch"` to a checkbox for a switch. The whole row is the label, at least 44px tall. |
| Tag input | `.tag-input[data-component="tag-input"]` | Enter or comma adds; Backspace removes; duplicates are rejected. `data-max`, `data-required`, `data-suggestions` (JSON). Submits a JSON array in its hidden input. |
| Drop zone | `.dropzone.knockout[data-component="dropzone"]` | One image. Drag-and-drop or the native picker (no `capture`, so phones offer the library and the camera). Preview with name, size and dimensions; Replace and Remove. `data-max-size` in MB. |
| Floating button | `button.fab[data-sheet-open="<id>"]` | Fixed bottom-right, clear of iPhone safe areas (needs `viewport-fit=cover`). `.fab--extended` + `.fab__label` for text. Put `.has-fab` on `<body>` so it never covers the last content. |
| Sheet | `dialog.sheet.sheet--bottom` or `.sheet--center`, `[data-component="sheet"]` | Bottom tearsheet (full height on phones) or centred modal, same insides. Focus stays inside; Esc and backdrop clicks close; an unsaved draft asks first; focus returns to the opener; the page can't scroll behind it; it shrinks above the on-screen keyboard. |
| Post form | `form[data-component="form post-form"]` | Photo, title, description, location, alt, tags, publish. Dispatches `jewel:post`. |

`data-component` can list several names; they run in order. Buttons grow to 44px tall on touch screens.

**Events**

| Event | On | Detail |
|---|---|---|
| `jewel:submit` | form | `{ form, formData, waitUntil(promise) }`. Fires on a valid submit. |
| `jewel:post` | post form | `{ file, title, description, location, alt, tags: string[], publish, formData, form, waitUntil(promise) }` |
| `jewel:tagschange` | tag input | `{ tags }` |
| `jewel:filechange` | drop zone | `{ file, source: 'user' \| 'api' \| 'clear' }` |
| `jewel:sheetopen` / `jewel:sheetclose` | dialog | none |

Call `waitUntil(promise)` to keep the form busy while you work. The submit button shows `data-busy-label` with a spinner. If the promise resolves, the form shows its `data-success` message and resets. If it rejects, the error's message is shown and the draft stays.

**JS API**

```js
form.jewelForm.setBusy(true)                  // also .setError(name, msg), .setFormError(msg),
                                              // .setStatus(msg), .clearErrors(), .isDirty(), .reset(), .validate()
Jewel.field.suggest(textarea, 'A mural…')     // fills only if the person hasn't typed; marked "Suggested" until edited
dropzone.jewelDropzone.setFile(blob, 'photo.webp')  // show and submit a processed file; also .getFile(), .clear()
tagInput.jewelTags.setSuggestions(['Pond', 'Dayton'])  // also .get(), .set([...]), .add(t), .remove(t)
dialog.jewelSheet.open(opener)                // also .close({ force }), .requestClose()
```

## Photos and filtering

Both came from the portfolio site and are also used by Photostream, its photo app.

| Component | Markup | Notes |
|---|---|---|
| Lightbox | `[data-component="lightbox"]` around `a[data-lightbox-item]` links | A full-screen viewer on a native `<dialog>`. Each link points at the full image, so it still works without JS. `data-caption` is the first line; `data-description` adds a quieter second line. Arrow keys and swipes move between photos, Esc closes, and focus goes back to the photo that opened it. Photos that are hidden, or inside a hidden parent (e.g. filtered out), are skipped. |
| Filter | `.filter.cluster[data-component="filter"]` with `button.tag.tag--button[data-filter]` | `data-filter-target` is a selector for the container; items inside it carry `data-tags="slug other-slug"`. `data-filter="*"` shows everything. A live region (`.filter__status`) announces the count, worded with `data-filter-noun`. Opening the page at `#tag=<slug>`, or following a `#tag=<slug>` link later, applies that tag. Buttons are looked up on every change, so a filter rendered by script works too. |
| Tag button | `button.tag.tag--button[aria-pressed]` | A pressable tag; pressed fills like `.tag--solid`. |

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

**Form fields** (added with the form components). Checked the same way, on dark glass over every Jewel colour, near-white and near-black, and on solid panels:

| Token | Value | Worst case | Needs |
|---|---|---|---|
| `--field-border` | white 40% | 3.25:1 | 3:1 (input edge) |
| `--field-border-hover` | white 60% | 5.35:1 | 3:1 |
| `--field-focus` | = `--text-accent` | 7.05:1 | 3:1 edge, 4.5:1 text |
| `--field-error` | `#FCA5A5` | 6.86:1 | 4.5:1 (it is also text) |
| `--field-placeholder` | = `--text-muted` | 6.32:1 | 4.5:1 |

The 10% panel hairline (`--panel-border`) measures only 1.27:1. That is fine for decorative rules, but too faint to show where a field is, so fields never use it for their edges. Disabled fields keep muted text (6.32:1) with a dashed edge, so they stay readable.

The background's `--bg-base` (#7A2E9E) sits inside the Jewel luminance range. Lowering `--bg-intensity` therefore never produces a backdrop worse than the cases tested above.

## Performance notes

- The background is a single fixed layer (`contain: strict`, its own compositing layer). Only registered custom properties animate, and no layout runs. The gradient is repainted each frame, but only inside that isolated layer. This is the cost of interpolating gradient colours.
- In glass mode, `backdrop-filter` has to re-sample the moving background on every frame. That is the most expensive part of the system. If a low-end device struggles, use `data-bg="paused"`, or keep large surfaces `solid` and use glass on small ones such as the header.
