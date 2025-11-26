const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

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

// ID de la carpeta en Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

// Leer imágenes locales de 'cover'
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname, 'cover'))
    .map(f => `/cover/${f}`);
} catch (err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// CSS estilo vintage compatible con Kobo
const css = `
body {
  font-family: sans-serif;
  margin: 10px;
  padding: 0;
  background: #2b2722;
  color: #3c2f25;
}

h1 {
  text-align: center;
  font-size: 28px;
  color: #d6c7a1;
  margin-bottom: 15px;
}

form {
  text-align: center;
  margin-bottom: 15px;
}

input, select {
  padding: 5px 7px;
  margin: 0 5px;
  font-size: 14px;
  border-radius: 6px;
  border: 1px solid #b8a891;
  background: #f3e7d3;
  color: #3c2f25;
}

.book {
  display: inline-block;
  width: 120px;
  margin: 6px;
  background: #f2e7d2;
  padding: 7px;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #c7b69d;
}

.book img {
  width: 80px;
  height: 120px;
  display: block;
  margin: 0 auto 5px;
  border-radius: 4px;
}

.title {
  font-size: 12px;
  font-weight: bold;
  color: #3c2f25;
  height: 36px;
  overflow: hidden;
}

.meta a {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  text-decoration: none;
  color: #7b4f21;
}
`;

// Listar todos los archivos con paginación
async function listAllFiles(folderId) {
  let files = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,createdTime)',
      pageSize: 1000,
      pageToken: pageToken || undefined
    });

    files = files.concat(res.data.files);
    pageToken = res.data.nextPageToken;

  } while (pageToken);

  return files;
}

// Ordenamiento opcional
function ordenarFiles(files, criterio) {
  if (!criterio) return files;

  let sorted = [...files];

  if (criterio === 'alfabetico') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (criterio === 'recientes') {
    sorted.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  }

  return sorted;
}

// Página principal
app.get('/', async (req, res) => {
  try {
    const query = (req.query.buscar || '').toLowerCase();
    const orden = req.query.ordenar || '';

    let files = await listAllFiles(folderId);

    // Filtrar por búsqueda
    if (query) {
      files = files.filter(f => f.name.toLowerCase().includes(query));
    }

    // Ordenar si corresponde
    files = ordenarFiles(files, orden);

    // Generar HTML de libros
    const booksHtml = files.map(file => {
      const cover = coverImages.length
        ? coverImages[Math.floor(Math.random() * coverImages.length)]
        : null;

      const imgHtml = cover
        ? `<img src="${cover}" />`
        : `<div style="width:80px;height:120px;background:#baa98a;margin:0 auto;border-radius:4px;">📖</div>`;

      return `
        <div class="book">
          ${imgHtml}
          <div class="title">${file.name}</div>
          <div class="meta">
            <a href="https://drive.google.com/uc?export=download&id=${file.id}" target="_blank">Descargar</a>
          </div>
        </div>
      `;
    }).join('');

    // HTML completo
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

      <form method="get" action="/">
        <input type="search" name="buscar" value="${req.query.buscar || ''}" placeholder="Buscar…" />
        <select name="ordenar" onchange="this.form.submit()">
          <option value="">Sin ordenar</option>
          <option value="alfabetico" ${orden === 'alfabetico' ? 'selected' : ''}>Alfabético</option>
          <option value="recientes" ${orden === 'recientes' ? 'selected' : ''}>Más recientes</option>
        </select>
      </form>

      <div id="grid">${booksHtml}</div>

    </body>
    </html>
    `;

    res.send(html);

  } catch (err) {
    console.error(err);
    res.send('<p>Error al cargar los libros. Revisa permisos del Service Account.</p>');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
