// A small GitHub REST client. Only what Photostream uses.
// The token never leaves this module except in the Authorization header,
// and is never logged.

import { config } from './config.js';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GitHubError';
    this.status = status; // 0 means the request never reached GitHub
  }
}

function contentsUrl({ owner, repo, branch }, path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${config.apiBase}/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`;
}

async function request(url, token, init = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new GitHubError(0, 'Network request failed');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GitHubError(res.status, body.message || res.statusText);
  }
  return res;
}

/** A file's raw contents from a repo branch, as a Response. */
export function readRaw(repo, path, token, init = {}) {
  return request(contentsUrl(repo, path), token, {
    ...init,
    headers: { Accept: 'application/vnd.github.raw' },
  });
}

/** The account a token belongs to: { login }. */
export async function getUser(token) {
  const res = await request(`${config.apiBase}/user`, token, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  return res.json();
}

/** Plain-English explanation of a failed GitHub call, for the UI. */
export function explain(err, what = 'your library') {
  switch (err?.status) {
    case 0:
      return `Couldn't reach GitHub to load ${what}. Check your connection.`;
    case 401:
      return "GitHub didn't accept your token. It may have expired. Add a new one in Settings.";
    case 403:
      return `GitHub refused to share ${what}. The token may be missing a permission, or you've hit GitHub's hourly limit. Try again soon.`;
    case 404:
      return `GitHub couldn't find ${what}. Check that your token can read ${config.library.owner}/${config.library.repo}.`;
    default:
      return `GitHub had a problem loading ${what}${err?.status ? ` (error ${err.status})` : ''}. Try again soon.`;
  }
}
