const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Comprimir PNG optimizando el nivel de compresión
const imagePath = path.join(__dirname, 'cover', 'portada', 'portada1.png');
const statsOriginal = fs.statSync(imagePath);
console.log(`Tamaño original: ${(statsOriginal.size / 1024 / 1024).toFixed(2)} MB`);

// Leer y recomprimir con máxima compresión
const buffer = fs.readFileSync(imagePath);
const compressed = zlib.deflateSync(buffer, { level: 9 });

console.log(`Tamaño comprimido (temp): ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
console.log('Nota: Para máxima compresión, usar herramientas externas como optipng o pngquant');
