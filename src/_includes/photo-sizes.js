// The resized WebP copies of a photo: the same ones the image transform makes
// for <img> tags (see eleventy.config.js). Used by /photos.json and /photos.xml.

import Image from "@11ty/eleventy-img";

// Keep in step with eleventyImageTransformPlugin in eleventy.config.js, so
// both write (and share) the same files.
const imageOptions = {
  widths: [480, 960, 1600, 2400],
  formats: ["webp"],
  outputDir: "_site/img/",
  urlPath: "/img/",
};

// "/assets/uploads/My photo.webp" → its sizes, smallest first.
export async function photoSizes(src) {
  const { webp } = await Image(`src${decodeURI(src)}`, imageOptions);
  return webp;
}
