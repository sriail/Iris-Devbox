import { cors } from "../utils/http.js";

// Wisp v1 packet types
const PKT = Object.freeze({
  CONNECT:  0x01,
  CONTINUE: 0x02,
  DATA:     0x03,
  CLOSE:    0x04,
});
const TCP_TYPE = 1;
const UDP_TYPE = 3;
const CLOSE_REASONS = Object.freeze({ UNKNOWN: 0x01, CLOSED: 0x02, ERROR: 0x03 });

export async function handleWispRelay(request) {
  const [client, server] = Object.values(new WebSocketPair());
  server.accept();

  const sockets = new Map();
  let nextId = 1;

  const send = (buf) => {
    try { server.send(buf); } catch {}
  };

  const closeSocket = async (id, reason = CLOSE_REASONS.CLOSED) => {
    const sock = sockets.get(id);
    if (!sock) return;
    sockets.delete(id);
    sock.closed = true;
    try { await sock.writer.close(); } catch {}

    const msg = new Uint8Array(6);
    const dv = new DataView(msg.buffer);
    dv.setUint8(0, PKT.CLOSE);
    dv.setUint32(1, id, false);
    dv.setUint8(5, reason);
    send(msg);
  };

  server.addEventListener("message", async (event) => {
    let buffer = event.data instanceof Blob
      ? await event.data.arrayBuffer()
      : event.data;
    const data = new Uint8Array(buffer);
    if (data.length < 1) return;

    const type = data[0];

    if (type === PKT.CONNECT) {
      if (data.length < 4) return;
      const port = (data[1] << 8) | data[2];
      const socketType = data[3];
      const hostname = new TextDecoder().decode(data.slice(4));

      if (socketType !== TCP_TYPE) return; // UDP not supported yet

      const id = nextId++;
      try {
        const tcp = connect({ hostname, port });
        const writer = tcp.writable.getWriter();
        const reader = tcp.readable.getReader();
        sockets.set(id, { writer, reader, closed: false, tcp });

        // CONTINUE ack
        const ack = new Uint8Array(7);
        const dv = new DataView(ack.buffer);
        dv.setUint8(0, PKT.CONTINUE);
        dv.setUint32(1, id, false);
        dv.setUint16(5, 65535, false);
        send(ack);

        // Read pump
        (async () => {
          try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const msg = new Uint8Array(5 + value.length);
                const d = new DataView(msg.buffer);
                d.setUint8(0, PKT.DATA);
                d.setUint32(1, id, false);
                msg.set(value, 5);
                send(msg);
            }
          } catch { /* reader closed */ }
          await closeSocket(id, CLOSE_REASONS.CLOSED);
        })();
      } catch (err) {
        console.error("wisp connect failed", err);
        // Synthetic id so client can match — use 0 if not yet assigned
        const failId = id;
        const msg = new Uint8Array(6);
        const dv = new DataView(msg.buffer);
        dv.setUint8(0, PKT.CLOSE);
        dv.setUint32(1, failId, false);
        dv.setUint8(5, CLOSE_REASONS.ERROR);
        send(msg);
      }
    }
    else if (type === PKT.DATA) {
      if (data.length < 5) return;
      const dv = new DataView(data.buffer);
      const id = dv.getUint32(1, false);
      const sock = sockets.get(id);
      if (sock && !sock.closed) {
        try { await sock.writer.write(data.slice(5)); }
        catch { await closeSocket(id, CLOSE_REASONS.ERROR); }
      }
    }
    else if (type === PKT.CLOSE) {
      if (data.length < 5) return;
      const dv = new DataView(data.buffer);
      const id = dv.getUint32(1, false);
      await closeSocket(id, CLOSE_REASONS.CLOSED);
    }
  });

  server.addEventListener("close", () => {
    for (const id of sockets.keys()) closeSocket(id, CLOSE_REASONS.CLOSED);
  });

  return new Response(null, { status: 101, webSocket: client });
}
