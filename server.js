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

// ID de la carpeta de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

// Leer imágenes cover locales (solo .png)
let coverImages = [];
try {
  coverImages = fs
    .readdirSync(path.join(__dirname, 'cover'))
    .filter(f => f.endsWith('.png'))
    .map(f => `/cover/${f}`);
} catch (err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// Leer o crear JSON con metadata
let bookMetadata = [];
const BOOKS_FILE = path.join(__dirname, 'books.json');
try {
  if (fs.existsSync(BOOKS_FILE)) {
    bookMetadata = JSON.parse(fs.readFileSync(BOOKS_FILE));
  } else {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify([], null, 2));
  }
} catch (err) {
  console.warn('Error leyendo books.json. Se usará un arreglo vacío.');
  bookMetadata = [];
}

// ------------------ CSS ARREGLADO ------------------

const css = `
body {
  background: #111;
  color: white;
  font-family: system-ui, sans-serif;
  margin: 0;
  padding: 0;
  text-align: center;
}

h1 {
  margin: 20px 0;
  font-weight: 700;
}

#grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
  padding: 20px;
  max-width: 1100px;
  margin: auto;
}

.book {
  background: #222;
  padding: 10px;
  border-radius: 10px;
  transition: transform .15s;
}

.book:hover {
  transform: scale(1.05);
}

.book img {
  width: 120px;
  height: 180px;
  object-fit: cover;
  border-radius: 6px;
}

.title {
  margin-top: 6px;
  font-size: 15px;
  font-weight: bold;
}

.author-span, .number-span {
  font-size: 12px;
  opacity: 0.8;
}

.meta a {
  display: inline-block;
  margin-top: 5px;
  padding: 5px 8px;
  background: #444;
  border-radius: 6px;
  color: white;
  text-decoration: none;
}

.meta a:hover {
  background: #666;
}

.button {
  padding: 10px 15px;
  background: #333;
  border-radius: 8px;
  display: inline-block;
  margin: 5px;
  color: white;
  text-decoration: none;
}

button, select, input[type="search"] {
  padding: 8px;
  margin: 10px;
  border-radius: 6px;
  border: none;
}

.header-banner {
  width: 100%;
  height: 8px;
  background: linear-gradient(90deg,#953DFF,#4B9EFF);
}
`;

// ------------------ FUNCIONES ------------------

async function listAllFiles(folderId) {
  let files = [], pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,createdTime)',
      pageSize: 1000,
      pageToken: pageToken || undefined,
    });
    files = files.concat(res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

function uniqueBooks(arr) {
  const seenIds = new Set();
  return arr.filter(b => {
    if (seenIds.has(b.id)) return false;
    seenIds.add(b.id);
    return true;
  });
}

function actualizarBooksJSON(newFiles) {
  let updated = false;

  newFiles.forEach(f => {
    const exists = bookMetadata.some(b => b.id === f.id);
    if (!exists) {
      const base = f.name.replace(/\.[^/.]+$/, '');
      const parts = base.split(' - ');
      const title = parts[0]?.trim() || f.name;
      const author = parts[1]?.trim() || 'Desconocido';

      let saga = null;
      if (parts[2]) {
        const sagaMatch = parts[2].match(/^(.*?)(?:\\s*#(\\d+))?$/);
        if (sagaMatch) {
          saga = { name: sagaMatch[1].trim() };
          if (sagaMatch[2]) saga.number = parseInt(sagaMatch[2], 10);
        }
      }

      bookMetadata.push({ id: f.id, title, author, saga });
      updated = true;
    }
  });

  if (updated) {
    bookMetadata = uniqueBooks(bookMetadata);
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
  }
}

// Portada determinística
function getCoverForBook(bookId) {
  if (coverImages.length === 0) return null;
  const index =
    bookId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) %
    coverImages.length;
  return coverImages[index];
}

// Ordenar libros
function ordenarBooks(books, criterio, tipo = null) {
  let sorted = [...books];
  if (tipo === 'autor' || tipo === 'saga') {
    if (criterio === 'alfabetico')
      sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
    else if (criterio === 'alfabetico-desc')
      sorted.sort((a, b) => b.title.toLowerCase().localeCompare(a.title.toLowerCase()));
    else if (criterio === 'numero')
      sorted.sort((a, b) => (a.saga?.number || 0) - (b.saga?.number || 0));
  } else {
    if (criterio === 'alfabetico')
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (criterio === 'alfabetico-desc')
      sorted.sort((a, b) => b.title.localeCompare(a.title));
    else if (criterio === 'recientes')
      sorted.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  }
  return sorted;
}

// ------------------ RENDER ------------------

function renderBookPage({ libros, titlePage, tipo, nombre, req }) {
  const orden = req.query.ordenar || 'alfabetico';
  libros = ordenarBooks(libros, orden, tipo);

  const booksHtml = libros
    .map(book => {
      const cover = getCoverForBook(book.id);
      const img = cover
        ? `<img src="${cover}" />`
        : `<div style="width:120px;height:180px;background:#333;border-radius:6px">📖</div>`;
      return `
<div class="book">
  ${img}
  <div class="title">${book.title}</div>
  <div class="author-span">${book.author}</div>
  ${book.saga?.number ? `<div class="number-span">#${book.saga.number}</div>` : ''}
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${book.id}" target="_blank">Descargar</a></div>
</div>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>${css}</style><title>${titlePage}</title></head>
<body>

<div class="header-banner"></div>

<h1>${titlePage}</h1>

<div class="top-buttons">
  <a href="/" class="button">🪄 Libros</a>
  ${tipo === 'autor' ? '<a href="/sagas" class="button">Sagas</a>' : '<a href="/autores" class="button">Autores</a>'}
</div>

<form method="get" action="/${tipo}">
<select name="ordenar" onchange="this.form.submit()">
  <option value="alfabetico" ${orden === 'alfabetico' ? 'selected' : ''}>A→Z</option>
  <option value="alfabetico-desc" ${orden === 'alfabetico-desc' ? 'selected' : ''}>Z→A</option>
  ${tipo === 'saga'
    ? `<option value="numero" ${orden === 'numero' ? 'selected' : ''}>#Número</option>`
    : ''}
</select>
<input type="hidden" name="name" value="${nombre}" />
</form>

<div id="grid">${booksHtml}</div>

</body>
</html>`;
}

// ------------------ RUTAS ------------------

app.get('/', async (req, res) => {
  try {
    const query = (req.query.buscar || '').toLowerCase();
    const orden = req.query.ordenar || 'alfabetico';

    let files = await listAllFiles(folderId);

    actualizarBooksJSON(files);

    if (query) {
      const q = query.toLowerCase();

      files = files.filter(f => {
        const meta = bookMetadata.find(b => b.id === f.id);
        if (!meta) return false;

        const t = meta.title.toLowerCase();
        const a = meta.author.toLowerCase();
        const s = meta.saga?.name?.toLowerCase() || "";
        const n = meta.saga?.number ? meta.saga.number.toString() : "";
        const fn = f.name.toLowerCase();

        return (
          t.includes(q) ||
          a.includes(q) ||
          s.includes(q) ||
          n === q ||
          fn.includes(q)
        );
      });
    }

    files = ordenarBooks(files, orden);

    const booksHtml = files
      .map(file => {
        const meta = bookMetadata.find(b => b.id === file.id);
        if (!meta) return '';

        const cover = getCoverForBook(file.id);
        const img = cover
          ? `<img src="${cover}" />`
          : `<div style="width:120px;height:180px;background:#333;border-radius:6px">📖</div>`;

        return `
<div class="book">
  ${img}
  <div class="title">${meta.title}</div>
  <div class="author-span">${meta.author}</div>
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${file.id}" target="_blank">Descargar</a></div>
</div>`;
      })
      .join('');

    res.send(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>${css}</style><title>Azkaban Reads</title></head>
<body>

<div class="header-banner"></div>

<h1>🪄 Azkaban Reads</h1>

<div class="top-buttons">
  <a href="/autores" class="button">Autores</a>
  <a href="/sagas" class="button">Sagas</a>
</div>

<form method="get" action="/">
<input type="search" name="buscar" value="${req.query.buscar || ''}" placeholder="Buscar..." />
<select name="ordenar" onchange="this.form.submit()">
  <option value="alfabetico" ${orden === 'alfabetico' ? 'selected' : ''}>A→Z</option>
  <option value="alfabetico-desc" ${orden === 'alfabetico-desc' ? 'selected' : ''}>Z→A</option>
  <option value="recientes" ${orden === 'recientes' ? 'selected' : ''}>Recientes</option>
</select>
</form>

<div id="grid">${booksHtml}</div>

</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.send('<p>Error al cargar libros.</p>');
  }
});

// ------------------- AUTORES -------------------

app.get('/autores', (req, res) => {
  const autores = [...new Set(bookMetadata.map(b => b.author).filter(a => a))].sort();

  const authorsHtml = autores
    .map(
      a => `
    <div class="book">
      <div class="title">${a}</div>
      <div class="meta"><a href="/autor?name=${encodeURIComponent(a)}">Ver libros</a></div>
    </div>
  `
    )
    .join('');

  res.send(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>${css}</style><title>Autores</title></head>
<body>

<div class="header-banner"></div>

<h1>Autores</h1>

<div class="top-buttons">
  <a href="/" class="button">🪄 Libros</a>
  <a href="/sagas" class="button">Sagas</a>
</div>

<div id="grid">${authorsHtml}</div>

</body>
</html>`);
});

// ------------------- SAGAS -------------------

app.get('/sagas', (req, res) => {
  const sagas = [...new Set(bookMetadata.map(b => b.saga?.name).filter(a => a))].sort();

  const sagasHtml = sagas
    .map(
      s => `
    <div class="book">
      <div class="title">${s}</div>
      <div class="meta"><a href="/saga?name=${encodeURIComponent(s)}">Ver libros</a></div>
    </div>
  `
    )
    .join('');

  res.send(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>${css}</style><title>Sagas</title></head>
<body>

<div class="header-banner"></div>

<h1>Sagas</h1>

<div class="top-buttons">
  <a href="/" class="button">🪄 Libros</a>
  <a href="/autores" class="button">Autores</a>
</div>

<div id="grid">${sagasHtml}</div>

</body>
</html>`);
});

app.get('/saga', (req, res) => {
  const nombreSaga = req.query.name;
  if (!nombreSaga) return res.redirect('/sagas');

  const libros = bookMetadata.filter(b => b.saga?.name === nombreSaga);

  res.send(
    renderBookPage({
      libros,
      titlePage: `Libros de ${nombreSaga}`,
      tipo: 'saga',
      nombre: nombreSaga,
      req,
    })
  );
});

// ------------------ INICIAR SERVIDOR ------------------

app.listen(PORT, () =>
  console.log(`Servidor escuchando en puerto ${PORT}`)
);
