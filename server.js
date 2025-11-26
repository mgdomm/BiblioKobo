const express = require('express');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir carpeta cover
app.use('/cover', express.static(path.join(__dirname, 'cover')));

// Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// ID de la carpeta de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

// Leer imágenes cover locales
let coverImages = [];
try {
  const fs = require('fs');
  coverImages = fs.readdirSync(path.join(__dirname,'cover')).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// CSS compatible con Kobo
const css = `
body {
  font-family: sans-serif;
  margin:10px; padding:0;
  background:#2e2b25; color:#f5f3ef;
}
h1 { text-align:center; font-size:28px; color:#d4c0a1; margin-bottom:10px; }
.book { display:inline-block; width:120px; margin:5px; vertical-align:top; background:#3e3a36; padding:5px; border-radius:6px; text-align:center; }
.book img { width:80px; height:120px; display:block; margin:0 auto 5px; border-radius:4px; }
.title { font-size:12px; color:#f5f3ef; overflow:hidden; height:36px; }
.meta a { display:block; margin-top:3px; font-size:11px; text-decoration:none; color:#c49a6c; }
.meta a:hover { color:#a67c4e; }
`;

// Ruta principal
app.get('/', async (req, res) => {
  try {
    // Listar todos los archivos de la carpeta (hasta 2000)
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 2000
    });

    const files = response.data.files || [];

    // Generar HTML completo en el servidor
    const booksHtml = files.map(file => {
      const cover = coverImages.length ? coverImages[Math.floor(Math.random()*coverImages.length)] : null;
      const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#8b735e;margin:0 auto;border-radius:4px;">📖</div>`;
      return `
<div class="book">
  ${imgHtml}
  <div class="title">${file.name}</div>
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${file.id}" target="_blank">Descargar</a></div>
</div>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Mi Biblioteca Kobo</title>
<style>${css}</style>
</head>
<body>
<h1>📚 Mi Biblioteca Kobo</h1>
<div id="grid">${booksHtml}</div>
</body>
</html>
`;

    res.send(html);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar los libros. Revisa permisos del Service Account.</p>');
  }
});

app.listen(PORT, ()=>console.log(`Servidor escuchando en puerto ${PORT}`));
