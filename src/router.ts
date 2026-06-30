import type { CustomHistory } from 'preact-router';

function getHashLoc() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const qi = raw.indexOf('?');
  return qi === -1
    ? { pathname: raw, search: '' }
    : { pathname: raw.slice(0, qi), search: raw.slice(qi) };
}

// Use this instead of route() from preact-router — ensures hash navigation fires correctly
export function navigate(path: string) {
  hashHistory.push(path);
}

export const hashHistory: CustomHistory = {
  get location() {
    return getHashLoc();
  },
  push(path: string) {
    window.location.hash = path;
  },
  replace(path: string) {
    // replace without adding to history stack
    const url = window.location.href.split('#')[0] + '#' + path;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },
  listen(cb) {
    const handler = () => cb(getHashLoc());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  },
};
