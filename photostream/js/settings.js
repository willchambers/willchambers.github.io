// What Photostream keeps on the phone. On iOS a home-screen app has its own
// storage, separate from Safari, so the token is entered once in the app.
// Nothing here is ever sent anywhere except the token, to GitHub.

const TOKEN_KEY = 'photostream.githubToken';
const LOGIN_KEY = 'photostream.githubLogin';

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* storage unavailable (private mode) */ }
};

export const settings = {
  get token() { return read(TOKEN_KEY); },
  set token(value) { write(TOKEN_KEY, value?.trim() || null); },

  // Only for showing "Connected as …".
  get login() { return read(LOGIN_KEY); },
  set login(value) { write(LOGIN_KEY, value || null); },
};
