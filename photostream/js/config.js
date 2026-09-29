// Where Photostream reads and writes.
// dev/server.mjs serves this file with apiBase pointed at its local GitHub
// mock, so development never touches the real repos.

export const config = {
  apiBase: 'https://api.github.com',

  // The private library: every post, published or not. It lives on its own
  // branch so the app's photo commits never mix with code history.
  library: { owner: 'willchambers', repo: 'photostream', branch: 'library' },

  // The public site. Published posts land here and go live after its build.
  site: {
    owner: 'willchambers',
    repo: 'willchambers.github.io',
    branch: 'main',
    url: 'https://willchambers.github.io',
    feed: '/photos.json', // same origin as the app
  },
};
