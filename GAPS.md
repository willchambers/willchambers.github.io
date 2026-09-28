# Jewel gap log

What building this site showed the Jewel design system is missing. Update this file as the site grows. When something moves into Jewel, mark it **Promoted**, run `npm run sync-jewel`, and delete the candidate copy.

## Built here as candidates

These live in `jewel-candidates/` and follow Jewel's component template: resolved tokens only, one CSS file per component, and `Jewel.register` for behaviour. Each can be copied into `jewel-design-system/css/components/` (and `js/components/`) unchanged. Then add an `@import` line to `jewel.css` and an example to `index.html`. `jewel-candidates/specimen.html` (served at `/jewel-candidates/specimen.html`) shows them all.

| Component | Why the site needed it | Status |
|---|---|---|
| `nav-toggle` | Jewel's header hides `.nav__links` below 40rem and offers nothing in their place, so phones had no navigation. | Candidate |
| `gallery` | A photo wall. Masonry by default (CSS columns keep each photo's shape); `--grid` crops to one ratio. | Candidate |
| `lightbox` | Full-screen viewer on a native `<dialog>`, with arrow keys, swipe, Esc, and focus returned to the photo. Works on any container of links. | Candidate |
| `card` + `card-grid` | Project tiles. Reuses `.figure__media`, so ratios match figures. | Candidate |
| `filter` + `.tag--button` | `.tag` was static only. This adds a pressed state for filter buttons, a live count for screen readers, and `#tag=` links. | Candidate |
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

## Hosting limits (not Jewel's fault)

- **Image sizes** come from the build (Eleventy Image makes 480, 960, 1600 and 2400px WebP copies). The CMS converts uploads to WebP at 2400px or smaller before committing them.
- **Build time** grows with the number of photos, because every build re-processes every image. Around a few hundred photos, add a cache step to the workflow.
