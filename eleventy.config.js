import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
import yaml from "js-yaml";
import { readFileSync } from "node:fs";

export default function (eleventyConfig) {
  // _data/*.yml, so the CMS and hand edits both use YAML.
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  // Files served as they are. The design system is a synced copy (sync-jewel.ps1);
  // jewel-candidates holds the components this site added on top of it.
  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "admin": "admin",
    "jewel": "jewel",
    "jewel-candidates": "jewel-candidates",
  });

  // Every <img> in the built pages gets resized copies and a srcset. One format
  // keeps the output a plain <img> (no <picture>), so Jewel's
  // `.figure__media > img` selectors still match.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp"],
    widths: [480, 960, 1600, 2400],
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
    },
  });

  // The feed plugin needs site details at config time, so read the same file
  // the templates use.
  const site = yaml.load(readFileSync("src/_data/site.yml", "utf8"));
  eleventyConfig.addPlugin(feedPlugin, {
    type: "atom",
    outputPath: "/feed.xml",
    collection: { name: "posts", limit: 20 },
    metadata: {
      language: "en",
      title: `${site.title} — Journal`,
      subtitle: site.description,
      base: `${site.url}/`,
      author: { name: site.author },
    },
  });

  // ---- Collections (oldest first, like Eleventy's own; templates reverse) ----
  const byDate = (a, b) => a.date - b.date;
  eleventyConfig.addCollection("posts", (api) => api.getFilteredByGlob("src/posts/*.md").sort(byDate));
  eleventyConfig.addCollection("projects", (api) => api.getFilteredByGlob("src/projects/*.md").sort(byDate));
  eleventyConfig.addCollection("photoSets", (api) => api.getFilteredByGlob("src/photos/*.md").sort(byDate));

  // Every photo from every set, newest set first.
  eleventyConfig.addCollection("photoStream", (api) =>
    api.getFilteredByGlob("src/photos/*.md").sort(byDate).reverse().flatMap((set) =>
      (set.data.images || []).map((photo) => ({
        ...photo,
        title: set.data.title,
        description: set.data.description,
        location: set.data.location,
        date: set.date,
        topics: set.data.topics || [],
      })),
    ),
  );

  // ---- Filters ------------------------------------------------------------
  const slugify = eleventyConfig.getFilter("slugify");

  eleventyConfig.addFilter("newest", (items = [], limit) => {
    const list = [...items].reverse();
    return limit ? list.slice(0, limit) : list;
  });

  // Featured projects, newest first; falls back to the latest ones.
  eleventyConfig.addFilter("featuredOrLatest", (items = [], limit = 4) => {
    const newest = [...items].reverse();
    const featured = newest.filter((item) => item.data.featured);
    return (featured.length ? featured : newest).slice(0, limit);
  });

  // "Night Walks" → "night-walks", space-separated, for data-tags.
  eleventyConfig.addFilter("topicSlugs", (topics = []) => topics.map((t) => slugify(t)).join(" "));

  // Unique topics across items, for filter buttons. Works on collection items
  // (item.data.topics) and on photoStream entries (item.topics).
  eleventyConfig.addFilter("topicsOf", (items = []) => {
    const all = items.flatMap((item) => (item.data ? item.data.topics : item.topics) || []);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  });

  const toDate = (d) => (d instanceof Date ? d : new Date(d));
  eleventyConfig.addFilter("readableDate", (d) =>
    toDate(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }),
  );
  eleventyConfig.addFilter("shortDate", (d) =>
    toDate(d).toLocaleDateString("en-US", { year: "numeric", month: "short", timeZone: "UTC" }),
  );
  eleventyConfig.addFilter("year", (d) => toDate(d).getUTCFullYear());
  eleventyConfig.addFilter("isoDate", (d) => toDate(d).toISOString());

  eleventyConfig.addFilter("readingTime", (html = "") => {
    const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  });

  // 3 → "03", for index-list numbers.
  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
  };
}
