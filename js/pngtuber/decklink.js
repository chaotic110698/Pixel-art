// Liaison avec le plugin Stream Deck « Pixel Atelier » (stream-deck/plugin/).
// Le plugin ouvre une connexion locale (ws://127.0.0.1:39217) ; l'avatar s'y connecte,
// lui envoie son catalogue (expressions, effets, fonds, profils) et son état, et reçoit
// les appuis sur les touches. Rien ne sort de l'ordinateur.
//
// IMPORTANT : createDeckLink doit rester AUTONOME (aucune référence extérieure) : son code
// est copié tel quel dans l'avatar .html exporté.
//
// o = {
//   url,                 // adresse du plugin (défaut ws://127.0.0.1:39217)
//   name(),              // nom du projet
//   catalog(),           // { expressions: [{ id, name, hold }], profiles, effects, backgrounds }
//   state(),             // { expression, profile, background, talking, ambient[] }
//   onCommand(cmd),      // { action, id, down, hold, toggle }
//   onStatus(connected), // facultatif
//   onPlugin(info),      // facultatif : { version } du plugin (1.2 et plus)
// }
export function createDeckLink(o) {
  const url = o.url || 'ws://127.0.0.1:39217';
  let ws = null;
  let closed = false;
  let timer = 0;
  let delay = 2000;
  let lastState = '';
  let connected = false;
  let plugin = null; // { version } annoncée par le plugin

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }
  function setConnected(v) {
    if (connected === v) return;
    connected = v;
    if (o.onStatus) o.onStatus(v);
  }
  function hello() {
    send({ type: 'hello', app: 'pixel-atelier', version: 1, name: o.name ? o.name() : '', catalog: o.catalog() });
    lastState = '';
    update();
  }
  function update() {
    if (!ws || ws.readyState !== 1) return;
    const s = JSON.stringify(o.state());
    if (s === lastState) return;
    lastState = s;
    send({ type: 'state', state: JSON.parse(s) });
  }
  function connect() {
    if (closed) return;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      schedule();
      return;
    }
    ws.onopen = () => {
      delay = 2000;
      setConnected(true);
      hello();
    };
    ws.onmessage = (ev) => {
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m) return;
      if (m.type === 'cmd' && o.onCommand) {
        o.onCommand(m);
        setTimeout(update, 0);
      } else if (m.type === 'catalog?') hello();
      else if (m.type === 'plugin') { plugin = { version: String(m.version || '') }; if (o.onPlugin) o.onPlugin(plugin); }
    };
    ws.onclose = () => {
      ws = null;
      plugin = null;
      setConnected(false);
      schedule();
    };
    ws.onerror = () => { /* la fermeture suit : nouvelle tentative */ };
  }
  function schedule() {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(connect, delay);
    delay = Math.min(15000, Math.round(delay * 1.5)); // plugin absent : on réessaie de plus en plus rarement
  }
  connect();
  // l'état change aussi sans commande (micro, touches du clavier) : vérification légère
  const poll = setInterval(update, 400);
  return {
    update,
    /** Le catalogue a changé (projet enregistré, nouvelle expression…). */
    refresh: hello,
    get connected() { return connected; },
    /** Plugin connecté : { version }, ou null (aucun, ou version 1.1 qui ne l'annonce pas). */
    get plugin() { return plugin; },
    close() {
      closed = true;
      clearTimeout(timer);
      clearInterval(poll);
      setConnected(false);
      if (ws) { ws.onclose = null; ws.close(); ws = null; }
    },
  };
}

/** Catalogue commun (éditeur, fenêtre de capture) à partir des listes de l'avatar. */
export function deckCatalog({ expressions, profiles, effects, scenes }) {
  return {
    expressions: expressions.map((e) => ({ id: e.id, name: e.name, hold: !!e.hold })),
    profiles: profiles.map((p) => ({ id: p.id, name: p.name })),
    effects: effects.map((e) => ({ id: e.id, name: e.name, kind: e.kind })),
    backgrounds: [['transparent', 'Transparent'], ['green', 'Vert'], ['blue', 'Bleu'], ['magenta', 'Magenta'], ['black', 'Noir'], ['white', 'Blanc'], ...Object.entries(scenes)]
      .map(([id, name]) => ({ id, name })),
  };
}
