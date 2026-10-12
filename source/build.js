// Builds dist/index.html (one self-contained file) and dist/pwa/ (installable offline app).
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const tpl = read('src/index.template.html');
const parts = { CSS: read('src/style.css'), ENGINE: read('src/engine.js'), AI: read('src/ai.js'), ART: read('src/art.js'), UI: read('src/ui.js') };

function assemble(extra) {
  let out = tpl;
  out = out.replace('{{HEAD_EXTRA}}', extra.head).replace('{{SW_REG}}', extra.sw);
  for (const k of Object.keys(parts)) out = out.replace(`{{${k}}}`, () => parts[k]);
  return out;
}

const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'pwa'), { recursive: true });

// 1. single file (works from a file or any web page; no install features)
fs.writeFileSync(path.join(dist, 'index.html'), assemble({ head: '', sw: '' }));

// 2. PWA folder
const version = Date.now().toString(36);
fs.writeFileSync(path.join(dist, 'pwa', 'index.html'), assemble({
  head: '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-192.png">',
  sw: `<script>if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }</script>`,
}));
fs.writeFileSync(path.join(dist, 'pwa', 'manifest.webmanifest'), JSON.stringify({
  name: 'Something Wild Solo', short_name: 'Wild Solo', description: 'Play Something Wild! against the computer, offline.',
  start_url: './index.html', scope: './', display: 'standalone', orientation: 'portrait',
  background_color: '#2c5f9e', theme_color: '#2c5f9e',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));
fs.writeFileSync(path.join(dist, 'pwa', 'sw.js'), `// Offline cache for Something Wild Solo
const CACHE = 'wild-solo-${version}';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
  }).catch(() => caches.match('./index.html'))));
});
`);
for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'])
  fs.copyFileSync(path.join(root, 'pwa-assets', f), path.join(dist, 'pwa', f));

const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log('dist/index.html', kb(path.join(dist, 'index.html')));
console.log('dist/pwa/index.html', kb(path.join(dist, 'pwa', 'index.html')));
