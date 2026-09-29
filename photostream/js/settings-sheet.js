// The Settings sheet: connect GitHub with a token, or remove it.
// Markup: #settings in index.html (a Jewel sheet holding a Jewel form).

import { config } from './config.js';
import { explain, getUser, readRaw } from './github.js';
import { forgetLibrary } from './library.js';
import { settings } from './settings.js';
import { VERSION } from './version.js';

const repoName = `${config.library.owner}/${config.library.repo}`;

// Check a token can do what Photostream needs to read, before keeping it.
// (Write access can only be proven by writing; posting explains itself if
// the token turns out to be read-only.)
async function check(token) {
  let user;
  try {
    user = await getUser(token);
  } catch (err) {
    if (err.status === 401) throw new Error("GitHub didn't accept this token. Check you copied all of it, and that it hasn't expired.");
    throw new Error(explain(err, 'your account'));
  }
  try {
    await readRaw(config.library, 'index.json', token, { cache: 'no-store' });
  } catch (err) {
    if (err.status === 404) {
      throw new Error(`This token can't read ${repoName}. Give it access to that repository (and willchambers.github.io), with Contents and Pull requests set to Read and write.`);
    }
    throw new Error(explain(err));
  }
  return user.login;
}

export function initSettings({ onChange }) {
  const sheet = document.getElementById('settings');
  const form = sheet.querySelector('#token-form');
  const connection = sheet.querySelector('[data-connection]');
  const forget = sheet.querySelector('[data-forget]');

  const show = () => {
    const connected = Boolean(settings.token);
    connection.textContent = connected
      ? `Connected as ${settings.login || 'your GitHub account'}. Your private library shows in the feed.`
      : 'Not connected. The feed shows published photos only.';
    forget.hidden = !connected;
  };

  form.addEventListener('jewel:submit', (e) => {
    const token = String(e.detail.formData.get('token') || '').trim();
    e.detail.waitUntil(check(token).then((login) => {
      settings.token = token;
      settings.login = login;
      show();
      onChange();
      // Let "Connected." register, then show the feed.
      setTimeout(() => sheet.jewelSheet?.close({ force: true }), 900);
    }));
  });

  forget.addEventListener('click', async () => {
    settings.token = null;
    settings.login = null;
    await forgetLibrary();
    show();
    form.jewelForm?.setStatus('Token removed. Your private photos are no longer saved on this phone.');
    onChange();
  });

  const version = sheet.querySelector('[data-version]');
  version.textContent = `Photostream ${VERSION}`;
  fetch(new URL('../jewel/VERSION', import.meta.url))
    .then((res) => (res.ok ? res.text() : ''))
    .then((jewel) => { if (jewel) version.textContent = `Photostream ${VERSION} · Jewel ${jewel.trim()}`; })
    .catch(() => {});

  show();
}
