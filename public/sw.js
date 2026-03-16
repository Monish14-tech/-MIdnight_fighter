const CACHE_NAME = 'midnight-fighter-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './game.js',
  './three.js',
  './audio.js',
  './player.js',
  './enemy.js',
  './boss.js',
  './projectile.js',
  './powerup.js',
  './particle.js',
  './ui.js',
  './leaderboard.js',
  './cosmic.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
