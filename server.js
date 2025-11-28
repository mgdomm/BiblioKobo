const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir carpeta cover y libros
app.use('/cover', express.static(path.join(__dirname, 'cover')));
app.use('/books', express.static(path.join(__dirname, 'books')));

// Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// ID de la carpeta de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

// Crear carpeta books si no existe
if (!fs.existsSync(path.join(__dirname, 'books'))) fs.mkdirSync(path.join(__dirname, 'books'));

// Leer imágenes cover locales
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname,'cover')).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// Leer o crear JSON con metadata de libros
let bookMetadata = [];
const BOOKS_FILE = path.join(__dirname, 'books.json');
try {
  if (fs.existsSync(BOOKS_FILE)) {
    bookMetadata = JSON.parse(fs.readFileSync(BOOKS_FILE));
  } else {
    fs.writeFileSync(BOOKS_FILE, JSON.stringify([], null, 2));
  }
} catch(err) {
  console.warn('Error leyendo books.json. Se usará un arreglo vacío.');
  bookMetadata = [];
}

// CSS global
const css = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap');
body { font-family: 'Garamond', serif; margin:5px; padding:0; background:#1c1a13; color:#f5e6c4; text-align:center; }
h1 { font-size:56px; font-family: 'MedievalSharp', cursive; color:#d4af7f; margin:10px 0; text-shadow: 1px 1px 2px #000; }
form { margin-bottom:10px; }
input, select { padding:4px 6px; margin:0 2px; font-size:12px; border-radius:6px; border:1px solid #a67c4e; background:#f5e6c4; color:#3e2f1c; }
#grid { text-align:center; }
.book { display:inline-block; vertical-align: top; width:110px; min-height:160px; background: #e8d7aa; padding:6px; border-radius:10px; border: 2px solid #d4af7f; margin:4px; text-align:center; word-wrap: break-word; }
.book img { width:80px; height:120px; border-radius:5px; object-fit:cover; margin-bottom:4px; }
.title { font-size:12px; font-weight:700; color:#3e2f1c; font-family: 'MedievalSharp', cursive; margin-bottom:2px; text-shadow: 1px 1px 0 #fff, -1px -1px 0 #000; }
.author a, .author-span { color:#8b7b5f; font-size:11px; text-decoration:none; }
.number-span { color:#8b7b5f; font-size:11px; }
.meta a { font-size:11px; font-weight:bold; text-decoration:none; color:#fff; background: #b5884e; padding:3px 6px; border-radius:5px; display:inline-block; margin-top:3px; box-shadow: inset 0 -2px 2px rgba(0,0,0,0.4), 1px 2px 3px rgba(0,0,0,0.5); transition: all 0.2s ease; }
.meta a:hover { background:#8b5f2c; box-shadow: inset 0 -2px 2px rgba(0,0,0,0.5), 1px 3px 5px rgba(0,0,0,0.6); transform: translateY(-1px); }
.meta a:visited { color:#fff; }
a.button { display:inline-block; margin:10px; text-decoration:none; padding:12px 24px; background:#b5884e; color:#fff; border-radius:10px; font-size:24px; font-weight:bold; box-shadow: inset 0 -3px 5px rgba(0,0,0,0.4), 3px 5px 8px rgba(0,0,0,0.5); }
a.button:hover { background:#8b5f2c; }
`;

// Funciones auxiliares
async function listAllFiles(folderId) {
  let files = [], pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,createdTime)',
      pageSize: 1000,
      pageToken: pageToken || undefined
    });
    files = files.concat(res.data.files);
    pageToken = res.data.nextPageToken;
  } while(pageToken);
  return files;
}

function uniqueBooks(arr) {
  const seenIds = new Set();
  return arr.filter(b => {
    if(seenIds.has(b.id)) return false;
    seenIds.add(b.id);
    return true;
  });
}

// Función para descargar libro automáticamente
async function downloadBook(file) {
  const destPath = path.join(__dirname, 'books', file.name);
  if (fs.existsSync(destPath)) return; // ya descargado
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'stream' }
  );
  await new Promise((resolve, reject) => {
    res.data
      .on('end', resolve)
      .on('error', reject)
      .pipe(dest);
  });
  console.log(`Libro descargado: ${file.name}`);
}

async function actualizarBooksJSON(newFiles) {
  let updated = false;
  for(const f of newFiles){
    const exists = bookMetadata.some(b => b.id === f.id);
    if(!exists){
      const base = f.name.replace(/\.[^/.]+$/, "");
      const parts = base.split(' - ');
      const title = parts[0]?.trim() || f.name;
      const author = parts[1]?.trim() || 'Desconocido';
      let saga = null;
      if(parts[2]){
        const sagaMatch = parts[2].match(/^(.*?)(?:\s*#(\d+))?$/);
        if(sagaMatch){
          saga = { name: sagaMatch[1].trim() };
          if(sagaMatch[2]) saga.number = parseInt(sagaMatch[2],10);
        }
      }
      bookMetadata.push({ id: f.id, title, author, saga, filename: f.name });
      updated = true;
      await downloadBook(f); // Descargar automáticamente
    }
  }
  if(updated){
    bookMetadata = uniqueBooks(bookMetadata);
    fs.writeFileSync(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
  }
}

function ordenarBooks(books, criterio, tipo=null) {
  let sorted = [...books];
  if(tipo==='autor' || tipo==='saga') {
    if(criterio==='alfabetico') sorted.sort((a,b)=> a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
    else if(criterio==='alfabetico-desc') sorted.sort((a,b)=> b.title.toLowerCase().localeCompare(a.title.toLowerCase()));
    else if(criterio==='numero') sorted.sort((a,b)=> (a.saga?.number||0) - (b.saga?.number||0));
  } else {
    if(criterio==='alfabetico') sorted.sort((a,b)=> a.title.localeCompare(b.title));
    else if(criterio==='alfabetico-desc') sorted.sort((a,b)=> b.title.localeCompare(a.title));
    else if(criterio==='recientes') sorted.sort((a,b)=> new Date(b.createdTime)-new Date(a.createdTime));
  }
  return sorted;
}

// Función para renderizar página de libros
function renderBookPage({ libros, titlePage, tipo, nombre, req }) {
  const orden = req.query.ordenar || 'alfabetico';
  libros = ordenarBooks(libros, orden, tipo);
  const maxHeight = 180;
  const booksHtml = libros.map(book => {
    const cover = coverImages.length ? coverImages[Math.floor(Math.random()*coverImages.length)] : null;
    const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#8b735e;border-radius:5px;">📖</div>`;
    return `
<div class="book" style="min-height:${maxHeight}px">
  ${imgHtml}
  <div class="title">${book.title}</div>
  <div class="author-span">${book.author}</div>
  ${book.saga?.number ? `<div class="number-span">#${book.saga.number}</div>` : ''}
  <div class="meta">
    <a href="/books/${encodeURIComponent(book.filename)}" target="_blank">Descargar</a>
    <a href="/read-online?file=${encodeURIComponent(book.filename)}" target="_blank">Leer Online</a>
  </div>
</div>`;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${titlePage}</title><style>${css}</style></head>
<body>
<h1>${titlePage}</h1>
<p>
  <a href="/" class="button">🪄 Libros</a>
  ${tipo==='autor'?'<a href="/sagas" class="button">Sagas</a>':'<a href="/autores" class="button">Autores</a>'}
</p>
<form method="get" action="/${tipo}">
<select name="ordenar" onchange="this.form.submit()">
  <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>A→Z</option>
  <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Z→A</option>
  ${tipo==='saga'?'<option value="numero" '+(orden==='numero'?'selected':'')+'>#Número</option>':''}
</select>
<input type="hidden" name="name" value="${nombre}" />
</form>
<div id="grid">${booksHtml}</div>
<p><a href="/${tipo==='autor'?'autores':'sagas'}" class="button">← Volver</a></p>
</body>
</html>`;
  return html;
}

// -------------------- Rutas --------------------

// Página de inicio
app.get('/', async (req, res) => {
  try {
    const query = (req.query.buscar || '').toLowerCase();
    const orden = req.query.ordenar || 'alfabetico';
    let files = await listAllFiles(folderId);
    await actualizarBooksJSON(files);

    if(query) files = files.filter(f => {
      const metadata = bookMetadata.find(b => b.id === f.id);
      const title = metadata ? metadata.title.toLowerCase() : f.name.toLowerCase();
      return title.includes(query);
    });
    files = ordenarBooks(files, orden);

    const maxHeight = 180;
    const booksHtml = files.map(file => {
      const metadata = bookMetadata.find(b => b.id === file.id);
      if(!metadata) return '';
      const title = metadata.title;
      const author = metadata.author;
      const cover = coverImages.length ? coverImages[Math.floor(Math.random()*coverImages.length)] : null;
      const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#8b735e;border-radius:5px;">📖</div>`;
      return `
<div class="book" style="min-height:${maxHeight}px">
  ${imgHtml}
  <div class="title">${title}</div>
  ${author ? `<div class="author"><a href="/autor?name=${encodeURIComponent(author)}">${author}</a></div>` : ''}
  <div class="meta">
    <a href="/books/${encodeURIComponent(metadata.filename)}" target="_blank">Descargar</a>
    <a href="/read-online?file=${encodeURIComponent(metadata.filename)}" target="_blank">Leer Online</a>
  </div>
</div>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Azkaban Reads</title><style>${css}</style></head>
<body>
<h1>🪄 Azkaban Reads</h1>
<p>
  <a href="/autores" class="button">Autores</a>
  <a href="/sagas" class="button">Sagas</a>
</p>
<form method="get" action="/">
<input type="search" name="buscar" value="${req.query.buscar || ''}" placeholder="Buscar título..." />
<select name="ordenar" onchange="this.form.submit()">
  <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>Alfabético A→Z</option>
  <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Alfabético Z→A</option>
  <option value="recientes" ${orden==='recientes'?'selected':''}>Más recientes</option>
</select>
</form>
<div id="grid">${booksHtml}</div>
</body>
</html>`;
    res.send(html);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar los libros. Revisa permisos del Service Account.</p>');
  }
});

// RUTA LEER ONLINE
app.get('/read-online', (req, res) => {
  const file = req.query.file;
  if(!file) return res.send('Archivo no especificado');

  const filePath = `/books/${file}`;
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Leer Online - ${file}</title>
<style>
body { margin:0; background:#000; }
#viewer { width:100vw; height:100vh; }
button { position:absolute; top:10px; padding:10px; background:#b5884e; color:#fff; border:none; font-size:16px; cursor:pointer; z-index:999; }
#prev { left:10px; }
#next { right:10px; }
</style>
</head>
<body>
<div id="viewer"></div>
<button id="prev">Anterior</button>
<button id="next">Siguiente</button>
<script src="https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js"></script>
<script>
const book = ePub("${filePath}");
const rendition = book.renderTo("viewer", { width:"100%", height:"100%" });
rendition.display();

document.getElementById("prev").addEventListener("click", ()=> rendition.prev());
document.getElementById("next").addEventListener("click", ()=> rendition.next());
</script>
</body>
</html>`;
  res.send(html);
});

// Página de autores
app.get('/autores', (req, res) => {
  const autores = [...new Set(bookMetadata.map(b => b.author).filter(a => a))].sort();
  const authorsHtml = autores.map(a => `<div class="book" style="min-height:100px"><div class="title">${a}</div><div class="meta"><a href="/autor?name=${encodeURIComponent(a)}">Ver libros</a></div></div>`).join('');
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Autores - Azkaban Reads</title><style>${css}</style></head>
<body>
<h1>Autores</h1>
<p>
  <a href="/" class="button">🪄 Libros</a>
  <a href="/sagas" class="button">Sagas</a>
</p>
<div id="grid">${authorsHtml}</div>
<p><a href="/" class="button">← Volver a libros</a></p>
</body>
</html>`;
  res.send(html);
});

// Página de libros por autor
app.get('/autor', (req, res) => {
  const nombreAutor = req.query.name;
  if(!nombreAutor) return res.redirect('/autores');
  const libros = bookMetadata.filter(b => b.author === nombreAutor);
  res.send(renderBookPage({ libros, titlePage: `Libros de ${nombreAutor}`, tipo: 'autor', nombre: nombreAutor, req }));
});

// Página de sagas
app.get('/sagas', (req, res) => {
  const sagas = [...new Set(bookMetadata.map(b => b.saga?.name).filter(a => a))].sort();
  const sagasHtml = sagas.map(s => `<div class="book" style="min-height:100px"><div class="title">${s}</div><div class="meta"><a href="/saga?name=${encodeURIComponent(s)}">Ver libros</a></div></div>`).join('');
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Sagas - Azkaban Reads</title><style>${css}</style></head>
<body>
<h1>Sagas</h1>
<p>
  <a href="/" class="button">🪄 Libros</a>
  <a href="/autores" class="button">Autores</a>
</p>
<div id="grid">${sagasHtml}</div>
<p><a href="/" class="button">← Volver a libros</a></p>
</body>
</html>`;
  res.send(html);
});

// Página de libros por saga
app.get('/saga', (req, res) => {
  const nombreSaga = req.query.name;
  if(!nombreSaga) return res.redirect('/sagas');
  const libros = bookMetadata.filter(b => b.saga?.name === nombreSaga);
  res.send(renderBookPage({ libros, titlePage: `Libros de ${nombreSaga}`, tipo: 'saga', nombre: nombreSaga, req }));
});

app.listen(PORT, ()=>console.log(`Servidor escuchando en puerto ${PORT}`));
