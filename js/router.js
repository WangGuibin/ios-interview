/* iOS 题宝库 · router.js:极简 hash 路由 */
'use strict';

window.App = window.App || {};

App.router = (() => {
  const routes = {}; // name -> { pattern: /^...$/, handler(params, query) }
  let current = null;
  let notFoundHandler = null;

  function register(name, pattern, handler) {
    routes[name] = { pattern, handler };
  }

  function parse(hash) {
    const raw = (hash || location.hash || '#/dash').replace(/^#/, '');
    const [path, qs] = raw.split('?');
    const query = {};
    if (qs) {
      for (const pair of qs.split('&')) {
        const [k, v] = pair.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    return { path, query };
  }

  function match(path) {
    for (const [name, r] of Object.entries(routes)) {
      const m = path.match(r.pattern);
      if (m) return { name, params: m.slice(1), handler: r.handler };
    }
    return null;
  }

  function dispatch() {
    const { path, query } = parse();
    const m = match(path);
    if (!m) {
      if (notFoundHandler) notFoundHandler(path);
      return;
    }
    current = m.name;
    m.handler(m.params, query);
    if (App.shell) App.shell.syncNav(m.name);
  }

  function go(hash, replace = false) {
    if (replace) {
      const url = location.pathname + location.search + hash;
      history.replaceState(null, '', url);
      dispatch();
    } else {
      location.hash = hash;
    }
  }

  function start(defaultHash) {
    window.addEventListener('hashchange', dispatch);
    if (!location.hash) location.hash = defaultHash;
    dispatch();
  }

  return {
    register, go, start, parse,
    onNotFound: (fn) => { notFoundHandler = fn; },
    get current() { return current; },
  };
})();
