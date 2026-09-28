# Jewel gap log

What building this site showed the Jewel design system is missing. Update this file as the site grows. When something moves into Jewel, mark it **Promoted**, run `npm run sync-jewel`, and delete the candidate copy.

## Built here as candidates

These live in `jewel-candidates/` and follow Jewel's component template: resolved tokens only, one CSS file per component, and `Jewel.register` for behaviour. Each can be copied into `jewel-design-system/css/components/` (and `js/components/`) unchanged. Then add an `@import` line to `jewel.css` and an example to `index.html`. `jewel-candidates/specimen.html` (served at `/jewel-candidates/specimen.html`) shows them all.

| Component | Why the site needed it | Status |
|---|---|---|
| `nav-toggle` | Jewel's header hides `.nav__links` below 40rem and offers nothing in their place, so phones had no navigation. | Candidate |
| `gallery` | A photo wall. Masonry by default (CSS columns keep each photo's shape); `--grid` crops to one ratio. | Candidate |
| `lightbox` | Full-screen viewer on a native `<dialog>`, with arrow keys, swipe, Esc, and focus returned to the photo. Works on any container of links. Photostream added an optional `data-description` line and skips photos inside hidden parents. | Candidate, to be promoted (Photostream uses it too) |
| `card` + `card-grid` | Project tiles. Reuses `.figure__media`, so ratios match figures. | Candidate |
| `filter` + `.tag--button` | `.tag` was static only. This adds a pressed state for filter buttons, a live count for screen readers, and `#tag=` links. Photostream made it follow `#tag=` links clicked after load and pick up buttons rendered later. | Candidate, to be promoted (Photostream uses it too) |
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
| **Forms** | No inputs, textarea or field styles, so a contact form isn't possible yet. |
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
| **Badge over media** | The carousel count and Photostream's "Private" / "Publishing…" status are both a `.label` on a small `--panel-bg` pill over a photo. That's one pattern (e.g. `.figure__badge`, top-left or top-right). |
| **Tags as links** | `.tag` on an `<a>` picks up the base link underline. Needs `a.tag { text-decoration: none }` in `tag.css`. |
| **Touch-size tags** | `.tag` is 24px tall. That's fine as a label, but too small to tap. Photostream draws tag buttons at 32px and stretches the tap area to 44px with a `::before`. A size variant or `--tag-height` would cover it. |
| **Scrolling filter row** | On a phone the filter works best as one row that scrolls sideways, edge to edge. Its grid parent needs `minmax(0, 1fr)`, otherwise the row widens the page. The row also needs block padding so the 44px tap areas aren't clipped. Worth a `.filter--scroll` variant. |
| **Narrow single-column pages** | Setting `--page-max: 44rem` on `.page` gives a feed column that works on a laptop too. Worth documenting as a layout option. |
| **Notices** | "Showing published photos only" and plain-English errors are plain captions for now. Jewel has no info or error notice. This overlaps **Empty states** and **Forms** (form-level errors). |
| **Long lists of panels** | `content-visibility: auto` with `contain-intrinsic-block-size` keeps a long feed of content panels fast. Only the block size can be estimated: `contain-intrinsic-size` with one value also fixes the width and breaks the layout. Worth a line in the README's performance notes. |

## Tooling

- `npm run sync-jewel` copies Jewel's working folder, so uncommitted work (and Jewel's `.claude/` folder) can be copied in. Photostream's version copies Jewel's last commit instead (`git archive HEAD`) and records it in `jewel/VERSION`. This site could do the same.

## Hosting limits (not Jewel's fault)

- **Image sizes** come from the build (Eleventy Image makes 480, 960, 1600 and 2400px WebP copies). The CMS converts uploads to WebP at 2400px or smaller before committing them.
- **Build time** grows with the number of photos, because every build re-processes every image. Around a few hundred photos, add a cache step to the workflow.
