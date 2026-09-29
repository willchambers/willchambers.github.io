// Small formatting helpers shared by the feed and (later) the composer.

// The site and its CMS write wall-clock times with no zone
// ("2026-09-27T22:25:00"), which Eleventy reads as UTC. Photostream reads and
// formats them the same way, so a photo shows the day it was taken, wherever
// the phone is.
export function parseDate(value) {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value);
  return new Date(`${value}Z`);
}

// "September 27, 2026": the journal's date format.
export const formatDate = (date) =>
  date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// "Dayton Walk" → "dayton-walk". Close to Eleventy's slugify, which the site
// uses for its #tag= filter links.
export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text for use inside HTML (content or a quoted attribute). */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
