---
title: Hello, Jewel
date: 2026-09-27T12:00:00.000Z
summary: A sample post that exercises every Markdown element, so the prose styles can be checked. Delete it once you've written your own.
image: /assets/uploads/sample-06.jpg
image_alt: Sample panorama in purple and orange
topics:
  - Design systems
  - Meta
---

This site is built on **Jewel**, a small design system for portfolio sites. This post is a sample. It shows how Markdown looks with the `.prose` styles, so replace it with your own writing.

## Why a site like this

A portfolio is a good way to test a design system. It has long-form text, image grids, project pages and navigation, and each of those finds gaps quickly.

- Photos are uploaded from `/admin`, from any browser, including a phone
- Every upload becomes a commit, and the site rebuilds in about a minute
- Images are resized automatically, so grids load small files

> Whitespace is the most expensive material on the page, so spend it deliberately.

### A picture in a post

![Sample landscape gradient](/assets/uploads/sample-01.jpg)

Inline `code` and code blocks use the media surface:

```css
.panel--content { border-radius: 0 2px 10px 10px; }
```

| Part | Where it lives |
|---|---|
| Design system | `jewel/` (synced copy) |
| New components | `jewel-candidates/` |
| Content | `src/posts`, `src/projects`, `src/photos` |

---

That's everything Markdown can produce. See [GAPS.md](https://github.com/willchambers/willchambers.github.io/blob/main/GAPS.md) for what the design system still needs.
