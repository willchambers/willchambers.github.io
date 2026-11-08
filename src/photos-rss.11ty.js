// /photos.xml — an RSS feed of the newest photo sets, so friends can follow
// them in any feed reader. Only what's published on the site is here; private
// Photostream posts never reach this repo.

import path from "node:path";
import { photoSizes } from "./_includes/photo-sizes.js";

const LIMIT = 50;

const xml = (text = "") =>
  String(text).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
const cdata = (text) => `<![CDATA[${String(text).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export default class {
  data() {
    return { permalink: "/photos.xml", eleventyExcludeFromCollections: true };
  }

  async render({ collections, site }) {
    const app = `${site.url}/photostream/`;
    const sets = [...collections.photoSets].reverse().slice(0, LIMIT);
    const items = [];

    for (const set of sets) {
      const id = path.basename(set.inputPath, ".md");
      const photos = [];
      for (const photo of set.data.images || []) {
        try {
          const sizes = await photoSizes(photo.image);
          // The 960px copy, or the largest if the photo is smaller than that.
          const size = sizes.find((s) => s.width >= 960) || sizes[sizes.length - 1];
          photos.push({ url: `${site.url}${size.url}`, size: size.size, alt: photo.alt || "" });
        } catch (err) {
          console.warn(`[photos.xml] Skipped ${photo.image} in ${set.inputPath}: ${err.message}`);
        }
      }
      if (!photos.length) continue;

      const { title, description, location } = set.data;
      const body = [
        description && `<p>${xml(description)}</p>`,
        ...photos.map((p) => `<p><img src="${xml(p.url)}" alt="${xml(p.alt)}"></p>`),
        location && `<p>${xml(location)}</p>`,
      ].filter(Boolean).join("");

      items.push(`    <item>
      <title>${xml(title)}</title>
      <link>${app}#post-${id}</link>
      <guid isPermaLink="false">${site.url}/photos/${id}</guid>
      <pubDate>${set.date.toUTCString()}</pubDate>
      <description>${cdata(body)}</description>
      <enclosure url="${xml(photos[0].url)}" length="${photos[0].size}" type="image/webp"/>
${photos.map((p) => `      <media:content url="${xml(p.url)}" medium="image" type="image/webp"/>`).join("\n")}
    </item>`);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xml(site.title)} — Photos</title>
    <link>${app}</link>
    <description>New photos from ${xml(site.title)}.</description>
    <language>en</language>
    <atom:link href="${site.url}/photos.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>
`;
  }
}
