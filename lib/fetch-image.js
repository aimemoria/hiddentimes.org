// Download a cover image from a web address so it can be kept in our own storage.
// (An image linked from another site can disappear or change; a copy in our storage can't.)
//
// Only signed-in admins can trigger this. It still refuses anything that isn't a public https
// address (no localhost, no private networks), checks every redirect the same way, stops after
// 15 seconds, and stops reading as soon as the file is larger than allowed.
const dns = require('dns').promises;
const net = require('net');

const fail = (message) => Object.assign(new Error(message), { status: 400 });

const privateV4 = (ip) => {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
};
const isPrivate = (ip) => {
  if (net.isIPv4(ip)) return privateV4(ip);
  const l = ip.toLowerCase();
  if (l.startsWith('::ffff:')) return isPrivate(l.slice(7));
  return l === '::' || l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
};

async function checkAddress(href) {
  let u;
  try { u = new URL(href); } catch { throw fail('The image address is not a valid URL.'); }
  if (u.protocol !== 'https:') throw fail('The image address must start with https://');
  if (u.username || u.password) throw fail('The image address must not contain a user name or password.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw fail(`The image address ${u.hostname} could not be found.`);
  if (addresses.some((a) => isPrivate(a.address))) throw fail('That image address is not allowed.');
  return u;
}

/**
 * @returns {Promise<Buffer>} the downloaded file (its type is checked by the caller with sniffImage)
 */
async function fetchImage(href, { maxBytes, siteUrl, timeoutMs = 15000 }) {
  let current = href;
  for (let hop = 0; hop < 4; hop++) {
    const u = await checkAddress(current);
    let r;
    try {
      r = await fetch(u, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        // Wikimedia and others ask automated clients to name themselves
        headers: { 'User-Agent': `HiddenTimesImageFetcher/1.0 (+${siteUrl})`, Accept: 'image/*' },
      });
    } catch (e) {
      throw fail(e.name === 'TimeoutError' ? 'The image took too long to download.' : 'The image could not be downloaded.');
    }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      current = new URL(r.headers.get('location'), u).href;
      continue;
    }
    if (!r.ok) {
      const wikimedia = u.hostname === 'upload.wikimedia.org' && r.status === 400
        ? ' Wikimedia only serves certain sizes: use the "Original file" link, or a standard width such as 1280px.' : '';
      throw fail(`The image address answered with an error (${r.status}).${wikimedia}`);
    }
    const tooBig = () => fail(`The image is larger than ${Math.round(maxBytes / 1024 / 1024)} MB. Use a smaller version (for example 1600 pixels wide).`);
    if (Number(r.headers.get('content-length') || 0) > maxBytes) throw tooBig();

    const chunks = [];
    let size = 0;
    for await (const chunk of r.body) {
      size += chunk.length;
      if (size > maxBytes) throw tooBig();
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw fail('The image address redirects too many times.');
}

module.exports = { fetchImage, isPrivate };
