
const CACHE_NAME = 'plant-ai-expert-v1';
// Đây là danh sách các file bạn muốn lưu lại để dùng khi offline.
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/services/geminiService.ts',
  '/utils/fileUtils.ts',
  '/components/Spinner.tsx',
  '/components/icons.tsx',
  '/components/MarkdownRenderer.tsx',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;700&display=swap'
];

// Sự kiện 'install': được gọi khi service worker được cài đặt lần đầu.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Sự kiện 'fetch': được gọi mỗi khi ứng dụng yêu cầu một tài nguyên (ví dụ: file, hình ảnh).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Nếu tìm thấy tài nguyên trong cache, trả về nó.
        if (response) {
          return response;
        }
        // Nếu không, thực hiện yêu cầu mạng như bình thường.
        return fetch(event.request);
      }
    )
  );
});
