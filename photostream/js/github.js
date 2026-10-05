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

// ---- Writing ------------------------------------------------------------------
// Posts are written with the Git Data API (blobs → tree → commit → ref), so a
// photo and everything that goes with it land in one commit.

const repoUrl = ({ owner, repo }) => `${config.apiBase}/repos/${owner}/${repo}`;
const JSON_HEADERS = { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };

async function api(repo, path, token, { method = 'GET', body } = {}) {
  const res = await request(`${repoUrl(repo)}${path}`, token, {
    method,
    headers: JSON_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status === 204 ? null : res.json();
}

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Upload a binary file once; returns its blob sha for commitFiles(). */
export async function createBlob(repo, token, blob) {
  const { sha } = await api(repo, '/git/blobs', token, {
    method: 'POST',
    body: { content: await toBase64(blob), encoding: 'base64' },
  });
  return sha;
}

/** Names in a folder on a branch (empty if the folder doesn't exist). */
export async function listNames(repo, token, folder) {
  try {
    const entries = await api(repo, `/contents/${folder}?ref=${encodeURIComponent(repo.branch)}`, token);
    return Array.isArray(entries) ? entries.map((entry) => entry.name) : [];
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

// files: [{ path, sha }] for uploaded blobs, or [{ path, content }] for text.
const treeEntry = ({ path, sha, content }) =>
  (sha ? { path, mode: '100644', type: 'blob', sha } : { path, mode: '100644', type: 'blob', content });

async function commitOnTop(repo, token, base, message, files) {
  const { tree } = await api(repo, `/git/commits/${base}`, token);
  const next = await api(repo, '/git/trees', token, {
    method: 'POST',
    body: { base_tree: tree.sha, tree: files.map(treeEntry) },
  });
  const commit = await api(repo, '/git/commits', token, {
    method: 'POST',
    body: { message, tree: next.sha, parents: [base] },
  });
  return commit.sha;
}

const tipOf = async (repo, token, branch) =>
  (await api(repo, `/git/ref/heads/${branch}`, token)).object.sha;

/**
 * Commit files to a branch as one commit. `build(tip)` returns
 * { message, files } for the branch's current tip, so a file like
 * index.json is rebuilt on top of the latest version. If the branch moved
 * meanwhile (someone else committed), it builds again on the new tip.
 */
export async function commitFiles(repo, token, build, { attempts = 3 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const base = await tipOf(repo, token, repo.branch);
    const { message, files } = await build(base);
    const sha = await commitOnTop(repo, token, base, message, files);
    try {
      await api(repo, `/git/refs/heads/${repo.branch}`, token, { method: 'PATCH', body: { sha, force: false } });
      return sha;
    } catch (err) {
      if (err.status === 422 && attempt < attempts) continue; // not a fast-forward: retry on the new tip
      throw err;
    }
  }
}

/** Commit files to a new branch made from repo.branch. */
export async function commitToNewBranch(repo, token, { branch, message, files }) {
  const base = await tipOf(repo, token, repo.branch);
  const sha = await commitOnTop(repo, token, base, message, files);
  await api(repo, '/git/refs', token, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha } });
  return sha;
}

export const deleteBranch = (repo, token, branch) =>
  api(repo, `/git/refs/heads/${branch}`, token, { method: 'DELETE' });

export const createPull = (repo, token, { title, head, body }) =>
  api(repo, '/pulls', token, { method: 'POST', body: { title, head, base: repo.branch, body } });

/** Pull requests (open or closed) from a branch of the same repo. */
export const findPulls = (repo, token, head) =>
  api(repo, `/pulls?state=all&head=${encodeURIComponent(`${repo.owner}:${head}`)}`, token);

/**
 * Squash-merge a pull request. GitHub works out whether a new PR can merge
 * a moment after it's opened, so a "not mergeable yet" answer is retried.
 */
export async function mergePull(repo, token, number, { title }) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await api(repo, `/pulls/${number}/merge`, token, {
        method: 'PUT',
        body: { merge_method: 'squash', commit_title: title },
      });
    } catch (err) {
      if (err.status === 405 && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

/** Plain-English explanation of a failed write, for the UI. */
export function explainWrite(err, repo) {
  const name = `${repo.owner}/${repo.repo}`;
  switch (err?.status) {
    case 0:
      return "No connection to GitHub. Your draft is still here; try again when you have signal.";
    case 401:
      return "GitHub didn't accept your token. It may have expired. Add a new one in Settings, then try again.";
    case 403:
      return `Your token can't write to ${name}. Give it Contents: Read and write and Pull requests: Read and write, or you've hit GitHub's hourly limit.`;
    case 404:
      return `Your token can't see ${name}. Add that repository to the token's access.`;
    case 405:
      return `GitHub wouldn't merge the pull request into ${name} (${err.message}).`;
    case 409:
    case 422:
      return `GitHub turned the change down (${err.message}). Try again in a moment.`;
    default:
      return err?.status >= 500
        ? 'GitHub is having trouble right now. Try again in a minute.'
        : `Something went wrong talking to GitHub${err?.status ? ` (error ${err.status})` : ''}.`;
  }
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
