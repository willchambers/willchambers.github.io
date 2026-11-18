# willchambers.github.io

Design portfolio, built on the [Jewel design system](https://github.com/willchambers/jewel-design-system). It's a static site made with [Eleventy](https://www.11ty.dev/), hosted on GitHub Pages, and edited through a browser-based CMS at `/admin`.

## How it fits together

```
src/                    content and templates (Eleventy input)
  projects/             case studies (Markdown)
  about.md              the About page
  _data/site.yml        title, URL, nav (edit by hand)
  _data/profile.yml     home page copy and links (edit in /admin)
  _includes/            layouts and partials (Liquid)
  assets/uploads/       images uploaded through /admin
admin/                  Sveltia CMS (index.html + config.yml)
jewel/                  synced copy of the design system; don't edit here
jewel-candidates/       components this site added on top of Jewel
GAPS.md                 what the design system still needs
.github/workflows/      build and deploy to GitHub Pages
```

Every push to `main` (including CMS saves) runs the workflow. It builds the site, resizes images, and publishes. That takes about a minute.

## Editing content

1. Go to **https://willchambers.github.io/admin/**
2. Choose **Sign In with Token** and paste a GitHub token (see below).
3. Edit **Projects**, or the home and About pages under **Site**. Then **Save**.

Uploads are converted to WebP at 2400px or smaller in your browser before they're committed.

### The token

Create one at **GitHub › Settings › Developer settings › Fine-grained tokens › Generate new token**:
- **Repository access:** Only select repositories › `willchambers.github.io`
- **Permissions:** Repository › **Contents: Read and write**
- Set an expiry, and create a new token when it runs out.

The CMS keeps the token in that browser only. Never commit it.

## Working locally

```bash
npm install
npm start
```

Then open http://localhost:8080. The CMS can also edit local files: open `http://localhost:8080/admin/` and choose **Work with Local Repository**.

## Updating the design system

Jewel lives in its own repo. After changing it:

```bash
npm run sync-jewel
```

That copies Jewel's last **commit** into `jewel/` (uncommitted work in the Jewel folder is left out, and it warns if the commit isn't pushed yet). `npm run sync-jewel -- -Ref <commit>` copies a particular one. The parked light theme is left out. Then commit.

When a component in `jewel-candidates/` is ready, move it into Jewel (see GAPS.md), sync, and delete the candidate. The photos and journal sites keep copies of the candidates they use, so update those too.
