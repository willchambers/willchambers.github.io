# Jewel gap log

What building this site showed the Jewel design system is missing. Update this file as the site grows. When something moves into Jewel, mark it **Promoted**, run `npm run sync-jewel`, and delete the candidate copy.

## Built here as candidates

These live in `jewel-candidates/` and follow Jewel's component template: resolved tokens only, one CSS file per component, and `Jewel.register` for behaviour. Each can be copied into `jewel-design-system/css/components/` (and `js/components/`) unchanged. Then add an `@import` line to `jewel.css` and an example to `index.html`. `jewel-candidates/specimen.html` (served at `/jewel-candidates/specimen.html`) shows them all.

| Component | Why the site needed it | Status |
|---|---|---|
| `nav-toggle` | Jewel's header hides `.nav__links` below 40rem and offers nothing in their place, so phones had no navigation. | Candidate |
| `gallery` | A photo wall. Masonry by default (CSS columns keep each photo's shape); `--grid` crops to one ratio. | Candidate |
| `lightbox` | Full-screen viewer on a native `<dialog>`, with arrow keys, swipe, Esc, and focus returned to the photo. Works on any container of links. Photostream added an optional `data-description` line and skips photos inside hidden parents; promoting it fixed tall photos covering the caption. | **Promoted** (Jewel 693799e) |
| `card` + `card-grid` | Project tiles. Reuses `.figure__media`, so ratios match figures. | Candidate |
| `filter` + `.tag--button` | `.tag` was static only. This adds a pressed state for filter buttons, a live count for screen readers, and `#tag=` links. Photostream made it follow `#tag=` links clicked after load and pick up buttons rendered later. `.tag--button` now lives in Jewel's `tag.css`. | **Promoted** (Jewel 693799e) |
| `prose` | Markdown output has no classes. It styles lists, code, tables, inline images and bare `<blockquote>`. | Candidate |
| `pager` | Older / newer links at the end of posts and projects. | Candidate |
| `skip-link` | Keyboard users had no way past the header. | Candidate |

## Still missing (not built yet)

| Gap | Notes |
|---|---|
| **`--font-mono` token** | `prose` falls back to a system mono stack. Jewel should choose one, or confirm the system stack. |
| **Syntax highlighting colours** | Code blocks are plain. Highlighting would need token colours that pass AA on `--media-bg`. |
| **Footer landmark** | The specimen puts `.site-footer` inside `<main class="panel-stack">` so it gets panel spacing, but that means it isn't a real page footer for screen readers. Consider letting `.panel-stack` exist outside `<main>` too. |
| **Index-list first column is fixed at 3rem** | Fine for `01`, but too narrow for dates. The site puts dates in the last column instead. A `--index-lead` custom property would fix it. |
| **`.quote` and `<blockquote>` duplicate styles** | `prose` copies the quote rules so bare Markdown quotes match. Better: make `.quote` a `:where(.quote, .prose blockquote)` rule in Jewel. |
| **Figure caption needs two spans** | A caption-only figure (no "Fig. n" label) works but isn't documented. |
| **Forms** | **Done in Jewel** (e9b0b6f): fields, inputs, choices, tag input, drop zone, floating button, sheet and a photo-post form, in the hairline-box style. Photostream is the first user. |
| **Empty states** | Pages print a plain caption when a collection is empty. A small pattern would help. |
| **Breadcrumb / back link** | Post and project pages use the header label as an ad-hoc breadcrumb (`Work · Identity`). |
| **Date format** | No convention. The site uses "September 27, 2026" for posts and "Sep 2026" in lists. |
| **Social image / favicon guidance** | Pages without a cover image get no `og:image`. A default share image in the Jewel style would help. |
| **Glass over many images** | Photo-heavy pages put a large glass panel over the animated background. It's fine on a laptop, but Jewel's README warns about `backdrop-filter` cost. Try `data-panel="solid"` on the photo wall if phones stutter. |
| **Light theme** | Still parked. Photos often read better on a lighter ground, which could be a reason to bring it back as its own direction. |

## Found by Photostream

[Photostream](https://github.com/willchambers/photostream) is a phone-first feed built on Jewel. Its own candidates live in its `app/jewel-candidates/`.

| Gap | Notes |
|---|---|
| **`carousel`** (candidate in Photostream) | Several photos in one figure: CSS scroll snap and a "1 / 3" count. Photo sets made in /admin often have more than one photo. |
| **Badge over media** | The carousel count and Photostream's "Private" / "Publishing…" status are both a `.label` on a small `--panel-bg` pill over a photo. That's one pattern. **In progress in Jewel** (`badge`, dd1889e, not pushed yet); Photostream switches to it once it's out. |
| **Tags as links** | `.tag` on an `<a>` picked up the base link underline. **Done in Jewel** (a1a7187): no underline, its own hover, `aria-current="page"` fills it. |
| **Touch-size tags** | `.tag` is 24px tall: fine as a label, too small to tap. **Done in Jewel** (46f2060): tags you can press or follow are 32px with a 44px tap area on touch screens; `.tag--touch` forces it. |
| **Scrolling filter row** | On a phone the filter works best as one row that scrolls sideways, edge to edge. Its grid parent needs `minmax(0, 1fr)`, otherwise the row widens the page. The row also needs block padding so the 44px tap areas aren't clipped. Worth a `.filter--scroll` variant. |
| **Narrow single-column pages** | Setting `--page-max: 44rem` on `.page` gives a feed column that works on a laptop too. Worth documenting as a layout option. |
| **Notices** | "You're offline", "Showing published photos only · Connect GitHub", "Updated · Reload" and plain-English errors are a caption with an optional button under it, for now. Jewel has no info or error notice. This overlaps **Empty states** and **Forms** (form-level errors). |
| **iPhone status bar** | A home-screen app with a see-through status bar (`black-translucent`) draws under it. Jewel's sticky header and `.jewel-cap` don't know about `env(safe-area-inset-top)`, and the lightbox's bars sit under the status bar and home indicator. Photostream raises `--sticky-offset` by the top inset (the cap then fills the status bar with the gradient) and pads the lightbox with `max(space, inset)`. The fab and sheet already handle it. |
| **`[hidden]` loses to components** | `.btn { display: inline-flex }` beats the browser's own `[hidden]` rule, so a hidden button still shows. `filter.css` and `badge` fix it locally; Jewel could fix it once with `[hidden] { display: none }` in the utilities layer. |
| **Busy label is fixed** | `form.jewelForm.setBusy(false)` puts back the label the button had when it went busy, so a label changed during `waitUntil` is overwritten. Photostream keeps its label fixed ("Save token"). |
| **Long lists of panels** | `content-visibility: auto` with `contain-intrinsic-block-size` keeps a long feed of content panels fast. Only the block size can be estimated: `contain-intrinsic-size` with one value also fixes the width and breaks the layout. Worth a line in the README's performance notes. |

## Tooling

- `npm run sync-jewel` now copies a Jewel **commit** (`git archive`), not Jewel's working folder, so uncommitted work can't leak in. It warns when the commit isn't pushed yet; `-Ref <commit>` picks one. (Photostream's does the same and records the commit in `jewel/VERSION`.)

## Hosting limits (not Jewel's fault)

- **Image sizes** come from the build (Eleventy Image makes 480, 960, 1600 and 2400px WebP copies). The CMS converts uploads to WebP at 2400px or smaller before committing them.
- **Build time** grows with the number of photos, because every build re-processes every image. Around a few hundred photos, add a cache step to the workflow.
