'use strict';

// On the web, images load progressively from dist/. The portable edition carries the same image bytes in its document.
function gameImageURL(path) {
 const images = globalThis.vomAssets;
 if (!images) return path;
 const url = images[path];
 if (!url) throw new Error('Thiếu ảnh trong bản ngoại tuyến: ' + path);
 return url;
}
const openPortableEdition = location.protocol === 'file:' && !globalThis.vomAssets;
if (openPortableEdition) location.replace('../CHOI-GAME.html');
