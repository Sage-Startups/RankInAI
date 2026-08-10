/**
 * Choosing the address the web server listens on.
 *
 * Extracted from start-web.js so it can be tested without booting Next.
 */

const net = require('node:net');

/**
 * `HOSTNAME` is NOT a bind address in a container.
 *
 * Docker sets HOSTNAME to the container id — `7097ab5995d3` — and Next's
 * standalone server passes whatever it finds there straight to listen(). The
 * result binds the one interface address that name resolves to, which is how
 * this app once logged `Local: http://7097ab5995d3:8080`, served nothing, and
 * failed its health check without a word.
 *
 * So a value is only honored when it is actually an address. Anything else is
 * a machine name that happened to be in the environment, and is ignored.
 * `WEB_BIND_HOST` exists for the rare case of pinning the bind deliberately.
 */
function isBindAddress(value) {
  const host = value.replace(/^\[/, '').replace(/\]$/, '');
  return host === 'localhost' || net.isIP(host) !== 0;
}

/**
 * Bind dual-stack ('::', IPv6 AND IPv4) whenever the environment supports it.
 *
 * This is load-bearing on Railway: its health checks and edge proxy connect
 * over the private network, which is IPv6. An app bound to 0.0.0.0 (IPv4
 * only) starts cleanly, reaches its database over outbound connections, and
 * then never receives a single inbound request — the health probe reports
 * "service unavailable" while the app logs nothing, because nothing ever
 * arrives. That silent failure shape cost this project several deployments.
 *
 * Hardcoding '::' is not safe either: IPv4-only environments (some CI
 * sandboxes and Docker configurations) fail to bind it with EAFNOSUPPORT and
 * the server dies. So probe once with a throwaway listener and use what works.
 *
 * Calls back with (hostname, why, ignored) — `ignored` is the environment
 * value that was rejected as a machine name, for logging, or null.
 */
function pickHostname(env, done) {
  const explicit = env.WEB_BIND_HOST || env.HOSTNAME;
  if (explicit && isBindAddress(explicit)) {
    done(explicit, 'from WEB_BIND_HOST/HOSTNAME', null);
    return;
  }
  const ignored = explicit || null;
  const probe = net.createServer();
  probe.once('error', () => done('0.0.0.0', 'IPv6 unavailable, IPv4 only', ignored));
  probe.listen({ host: '::', port: 0, ipv6Only: false }, () => {
    probe.close(() => done('::', 'dual-stack IPv6 + IPv4', ignored));
  });
}

module.exports = { isBindAddress, pickHostname };
