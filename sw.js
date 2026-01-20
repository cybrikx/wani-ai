const CACHE_NAME = 'wani-ai-v1';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/script.js',
    './js/data.js',
    './logo.png',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
