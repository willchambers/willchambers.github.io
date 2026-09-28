// /photos.json — every photo set, newest first, for the Photostream app
// (github.com/willchambers/photostream, served at /photostream/).
//
// Each photo comes with the same resized WebP copies the image transform makes
// for <img> tags (see eleventy.config.js), so the app can use srcset and never
// has to download the full-size upload on a phone.

import Image from "@11ty/eleventy-img";
import path from "node:path";

// Keep in step with eleventyImageTransformPlugin in eleventy.config.js, so
// both write (and share) the same files.
const imageOptions = {
  widths: [480, 960, 1600, 2400],
  formats: ["webp"],
  outputDir: "_site/img/",
  urlPath: "/img/",
};

async function sizesFor(src) {
  // "/assets/uploads/My photo.webp" → "src/assets/uploads/My photo.webp"
  const file = `src${decodeURI(src)}`;
  const { webp } = await Image(file, imageOptions);
  const largest = webp[webp.length - 1];
  return {
    src: largest.url,
    width: largest.width,
    height: largest.height,
    srcset: webp.map((size) => `${size.url} ${size.width}w`).join(", "),
  };
}

export default class {
  data() {
    return { permalink: "/photos.json", eleventyExcludeFromCollections: true };
  }

  async render({ collections, site }) {
    const posts = [];

    for (const set of [...collections.photoSets].reverse()) {
      const photos = [];
      for (const photo of set.data.images || []) {
        try {
          photos.push({
            ...(await sizesFor(photo.image)),
            original: photo.image,
            alt: photo.alt || "",
            caption: photo.caption || "",
          });
        } catch (err) {
          console.warn(`[photos.json] Skipped ${photo.image} in ${set.inputPath}: ${err.message}`);
        }
      }
      if (!photos.length) continue;

      posts.push({
        // The file name, date prefix included (fileSlug drops it). Photostream
        // names its posts the same way, so ids match across the two.
        id: path.basename(set.inputPath, ".md"),
        title: set.data.title,
        description: set.data.description || "",
        date: set.date.toISOString(),
        location: set.data.location || "",
        topics: set.data.topics || [],
        photos,
      });
    }

    return JSON.stringify({
      version: 1,
      title: `${site.title} — Photos`,
      home_page_url: `${site.url}/photos/`,
      posts,
    });
  }
}
