// Posting. The photo goes into the private library first, in one commit, so
// it's safe as soon as that succeeds. Then, if it's to be published, it goes
// to the site by pull request, which the app merges straight away; the site
// rebuilds and the post shows up in /photos.json about a minute later.
//
// Files written:
//   library  photos/<id>.webp, thumbs/<id>.webp, posts/<id>.md, index.json
//   site     src/assets/uploads/<id>.webp, src/photos/<id>.md
// The site files are exactly what /admin would make, so /admin can edit them.

import { config } from './config.js';
import { slugify } from './format.js';
import {
  commitFiles, commitToNewBranch, createBlob, createPull, deleteBranch,
  explainWrite, findPulls, listNames, mergePull, readRaw,
} from './github.js';
import { publishing } from './publishing.js';

const pad = (n) => String(n).padStart(2, '0');

/** Wall-clock time with no zone, as /admin writes it: 2026-10-04T14:05:00 */
export function wallTime(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** 2026-10-04-under-the-bridge, or …-2, …-3 if that's taken. */
export function newId(title, date, taken) {
  const base = `${date.slice(0, 10)}-${slugify(title) || 'photo'}`;
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

const q = (value) => JSON.stringify(value ?? ''); // JSON strings are valid YAML

/** A post as the site's photo-set Markdown (front matter only). */
export function postMarkdown(post, { library = false } = {}) {
  const photo = post.photos[0];
  return [
    '---',
    `title: ${q(post.title)}`,
    `description: ${q(post.description)}`,
    `date: ${post.date}`,
    `location: ${q(post.location)}`,
    `topics: [${post.topics.map(q).join(', ')}]`,
    ...(library ? [`publish: ${post.publish}`] : []),
    'images:',
    `  - image: ${q(`/assets/uploads/${post.id}.webp`)}`,
    `    alt: ${q(photo.alt)}`,
    '    caption: ""',
    '---',
    '',
  ].join('\n');
}

/** Ids already used on the site (photo sets and uploads), to avoid clashes. */
export async function siteIds(token) {
  const [sets, uploads] = await Promise.all([
    listNames(config.site, token, 'src/photos'),
    listNames(config.site, token, 'src/assets/uploads'),
  ]);
  return new Set([
    ...sets.filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3)),
    ...uploads.map((n) => n.replace(/\.[^.]+$/, '')),
  ]);
}

/**
 * Save a post to the private library. Resolves with the post as it's now
 * stored. Throws an Error with a plain-English message; nothing is half
 * written, because it's all one commit.
 */
export async function saveToLibrary({ fields, photo, token, taken = new Set() }) {
  const repo = config.library;
  const date = wallTime();
  let post;
  try {
    // Upload the images once, so a retried commit is quick.
    const [fullSha, thumbSha] = await Promise.all([
      createBlob(repo, token, photo.full),
      createBlob(repo, token, photo.thumb),
    ]);
    await commitFiles(repo, token, async (tip) => {
      const index = await (await readRaw({ ...repo, branch: tip }, 'index.json', token, { cache: 'no-store' })).json();
      const posts = Array.isArray(index.posts) ? index.posts : [];
      const id = newId(fields.title, date, new Set([...taken, ...posts.map((p) => p.id)]));
      post = {
        id,
        title: fields.title,
        description: fields.description,
        date,
        location: fields.location,
        topics: fields.tags,
        publish: fields.publish,
        photos: [{
          file: `photos/${id}.webp`,
          thumb: `thumbs/${id}.webp`,
          width: photo.width,
          height: photo.height,
          alt: fields.alt,
        }],
      };
      return {
        message: `Add “${post.title}” (${id})`,
        files: [
          { path: post.photos[0].file, sha: fullSha },
          { path: post.photos[0].thumb, sha: thumbSha },
          { path: `posts/${id}.md`, content: postMarkdown(post, { library: true }) },
          { path: 'index.json', content: `${JSON.stringify({ ...index, version: 1, posts: [post, ...posts] }, null, 2)}\n` },
        ],
      };
    });
  } catch (err) {
    throw new Error(err.status === undefined ? err.message : explainWrite(err, repo));
  }
  return post;
}

/** The full-size photo of a library post (to publish one posted privately). */
export async function libraryPhoto(post, token) {
  const res = await readRaw(config.library, post.photos[0].file, token);
  return new Blob([await res.arrayBuffer()], { type: 'image/webp' });
}

/**
 * Publish a library post to the site: a branch, a pull request, a squash
 * merge, and the branch tidied away. Safe to call again after a failure:
 * it picks up the pull request it already opened.
 */
export async function publishToSite({ post, full, token }) {
  const site = config.site;
  const branch = `photostream/${post.id}`;
  publishing.set(post.id, { state: 'publishing', title: post.title, error: null });
  try {
    const [existing] = await findPulls(site, token, branch);
    let number = existing?.number;
    if (!existing?.merged_at) {
      if (!existing) {
        // A branch left by an earlier attempt that didn't get as far as a PR.
        await deleteBranch(site, token, branch).catch(() => {});
        const photoSha = await createBlob(site, token, full);
        await commitToNewBranch(site, token, {
          branch,
          message: `Add Photo set “${post.id}” from Photostream`,
          files: [
            { path: `src/assets/uploads/${post.id}.webp`, sha: photoSha },
            { path: `src/photos/${post.id}.md`, content: postMarkdown(post) },
          ],
        });
        const pr = await createPull(site, token, {
          title: `Add photo: ${post.title}`,
          head: branch,
          body: `Posted from Photostream.\n\n> ${post.description}`,
        });
        number = pr.number;
        publishing.set(post.id, { pr: number });
      }
      await mergePull(site, token, number, { title: `Add Photo set “${post.id}” (#${number})` });
    }
    await deleteBranch(site, token, branch).catch(() => {}); // tidy, not essential
    publishing.set(post.id, { state: 'publishing', merged: true });
  } catch (err) {
    const error = err.status === undefined ? err.message : explainWrite(err, site);
    publishing.set(post.id, { state: 'failed', error });
    throw new Error(error);
  }
}
