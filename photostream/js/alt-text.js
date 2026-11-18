// Alt text: a plain starting point from the title and place, suggested in
// the composer. It's only a suggestion: edit it, clear it, or write your own;
// posting never waits for it.

export const plainAltText = ({ title, location }) =>
  [title && `Photo: ${title}`, location].filter(Boolean).join(', ');
