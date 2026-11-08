// WebSocket minimal (RFC 6455), sans dépendance : serveur (pour l'avatar) et client
// (pour le logiciel Stream Deck). Messages texte JSON uniquement.
'use strict';

const crypto = require('crypto');
const http = require('http');
const net = require('net');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const acceptKey = (key) => crypto.createHash('sha1').update(key + GUID).digest('base64');

/** Une connexion WebSocket ouverte. Évènements : 'message' (texte), 'close'. */
class Conn extends EventEmitter {
  constructor(socket, { client = false, head = null, origin = '' } = {}) {
    super();
    this.socket = socket;
    this.client = client; // un client masque ses trames
    this.origin = origin;
    this.buf = Buffer.alloc(0);
    this.parts = [];
    this.open = true;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._data(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
    if (head && head.length) this._data(head);
  }

  send(text) {
    if (!this.open) return;
    this._frame(1, Buffer.from(String(text), 'utf8'));
  }

  close() {
    if (!this.open) return;
    try { this._frame(8, Buffer.alloc(0)); } catch (e) { /* déjà fermée */ }
    this.socket.end();
    this._closed();
  }

  _closed() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }

  _frame(opcode, payload) {
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | opcode, (this.client ? 0x80 : 0) | len]);
    else if (len < 65536) {
      head = Buffer.alloc(4);
      head[0] = 0x80 | opcode; head[1] = (this.client ? 0x80 : 0) | 126; head.writeUInt16BE(len, 2);
    } else {
      head = Buffer.alloc(10);
      head[0] = 0x80 | opcode; head[1] = (this.client ? 0x80 : 0) | 127; head.writeBigUInt64BE(BigInt(len), 2);
    }
    if (this.client) {
      const mask = crypto.randomBytes(4);
      const data = Buffer.alloc(len);
      for (let i = 0; i < len; i++) data[i] = payload[i] ^ mask[i & 3];
      this.socket.write(Buffer.concat([head, mask, data]));
    } else this.socket.write(Buffer.concat([head, payload]));
  }

  _data(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, opcode = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        len = Number(this.buf.readBigUInt64BE(2)); off = 10;
      }
      const maskOff = off;
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = this.buf.subarray(off, off + len);
      if (masked) {
        const mask = this.buf.subarray(maskOff, maskOff + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      } else payload = Buffer.from(payload);
      this.buf = this.buf.subarray(off + len);
      if (opcode === 8) { this.close(); return; }
      if (opcode === 9) { this._frame(10, payload); continue; }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 2 || opcode === 0) {
        this.parts.push(payload);
        if (fin) {
          const text = Buffer.concat(this.parts).toString('utf8');
          this.parts = [];
          this.emit('message', text);
        }
      }
    }
  }
}

/**
 * Serveur WebSocket sur host:port. accept(origin) décide si une page peut se connecter.
 * Une requête HTTP ordinaire reçoit une courte page de diagnostic.
 */
function createServer({ host = '127.0.0.1', port, accept = () => true, info = 'ok' }, onConnection) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(typeof info === 'function' ? info() : info);
  });
  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    const origin = req.headers.origin || '';
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket' || !accept(origin)) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey(key)}`, '', ''].join('\r\n'));
    onConnection(new Conn(socket, { head, origin }));
  });
  server.listen(port, host);
  return server;
}

/** Client WebSocket (ws://hôte:port/chemin). Résout avec la connexion ouverte. */
function connect(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const socket = net.connect(Number(u.port) || 80, u.hostname);
    const key = crypto.randomBytes(16).toString('base64');
    let head = Buffer.alloc(0);
    const onData = (d) => {
      head = Buffer.concat([head, d]);
      const end = head.indexOf('\r\n\r\n');
      if (end < 0) return;
      socket.off('data', onData);
      const lines = head.subarray(0, end).toString('latin1').split('\r\n');
      const ok = / 101 /.test(lines[0]) && lines.some((l) => /^sec-websocket-accept:/i.test(l) && l.split(':')[1].trim() === acceptKey(key));
      if (!ok) { socket.destroy(); reject(new Error('Réponse WebSocket invalide : ' + lines[0])); return; }
      resolve(new Conn(socket, { client: true, head: head.subarray(end + 4) }));
    };
    socket.on('data', onData);
    socket.once('error', reject);
    socket.on('connect', () => {
      socket.write([`GET ${u.pathname || '/'} HTTP/1.1`, `Host: ${u.host}`, 'Upgrade: websocket', 'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '', ''].join('\r\n'));
    });
  });
}

module.exports = { createServer, connect, Conn };
