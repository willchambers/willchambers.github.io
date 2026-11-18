import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import yaml from "js-yaml";

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

  // ---- Collections (oldest first, like Eleventy's own; templates reverse) ----
  const byDate = (a, b) => a.date - b.date;
  eleventyConfig.addCollection("projects", (api) => api.getFilteredByGlob("src/projects/*.md").sort(byDate));

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

  // Unique topics across collection items, for filter buttons.
  eleventyConfig.addFilter("topicsOf", (items = []) => {
    const all = items.flatMap((item) => item.data.topics || []);
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  });

  const toDate = (d) => (d instanceof Date ? d : new Date(d));
  eleventyConfig.addFilter("year", (d) => toDate(d).getUTCFullYear());
  eleventyConfig.addFilter("isoDate", (d) => toDate(d).toISOString());

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
  };
}
