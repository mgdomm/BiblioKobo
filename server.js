const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const axios = require('axios'); // para descargar ePubs

const app = express();
const PORT = process.env.PORT || 3000;

// Servir carpetas
app.use('/cover', express.static(path.join(__dirname, 'cover')));
app.use('/epub', express.static(path.join(__dirname, 'epub'))); // carpeta para ePubs

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

// CSS global (igual que antes)
const css = `...`; // tu CSS original aquí

// ---------------- Funciones auxiliares ----------------
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

function actualizarBooksJSON(newFiles) {
  let updated = false;
  newFiles.forEach(f => {
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
      bookMetadata.push({ id: f.id, title, author, saga });
      updated = true;
    }
  });
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
    if(criterio==='alfabetico') sorted.sort((a,b)=> (bookMetadata.find(x=>x.id===a.id)?.title||a.name).localeCompare(bookMetadata.find(x=>x.id===b.id)?.title||b.name));
    else if(criterio==='alfabetico-desc') sorted.sort((a,b)=> (bookMetadata.find(x=>x.id===b.id)?.title||b.name).localeCompare(bookMetadata.find(x=>x.id===a.id)?.title||a.name));
    else if(criterio==='recientes') sorted.sort((a,b)=> new Date(b.createdTime)-new Date(a.createdTime));
  }
  return sorted;
}

// ---------------- Función para leer online ----------------
async function downloadEpubIfNeeded(fileId, fileName) {
  const epubPath = path.join(__dirname, 'epub', fileName);
  if (fs.existsSync(epubPath)) return `/epub/${fileName}`; // ya existe

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const headers = { Authorization: `Bearer ${(await auth.getClient()).credentials.access_token}` };
  const writer = fs.createWriteStream(epubPath);

  const response = await axios.get(url, { headers, responseType: 'stream' });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(`/epub/${fileName}`));
    writer.on('error', reject);
  });
}

// ---------------- Render genérico de libros ----------------
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
    <a href="https://drive.google.com/uc?export=download&id=${book.id}" target="_blank">Descargar</a><br/>
    <a href="/leer-online?id=${book.id}&name=${encodeURIComponent(book.title+'.epub')}" style="text-decoration:none; color:#fff; font-weight:bold;">Leer Online</a>
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

// Leer online
app.get('/leer-online', async (req, res) => {
  try {
    const fileId = req.query.id;
    const fileName = req.query.name || 'libro.epub';
    if(!fileId) return res.send('No se especificó un libro.');

    const epubUrl = await downloadEpubIfNeeded(fileId, fileName);

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Leer Online - ${fileName}</title>
<script src="https://unpkg.com/epubjs/dist/epub.min.js"></script>
<style>
body { margin:0; background:#1c1a13; color:#f5e6c4; text-align:center; }
#reader { width:100%; height:100vh; }
button { position:fixed; top:10px; padding:10px; background:#b5884e; border:none; color:#fff; font-size:16px; cursor:pointer; }
#prev { left:10px; }
#next { right:10px; }
</style>
</head>
<body>
<button id="prev">⏮ Anterior</button>
<button id="next">Siguiente ⏭</button>
<div id="reader"></div>
<script>
const book = ePub("${epubUrl}");
const rendition = book.renderTo("reader", { width:"100%", height:"100%" });
rendition.display();

document.getElementById('prev').addEventListener('click', ()=>rendition.prev());
document.getElementById('next').addEventListener('click', ()=>rendition.next());
</script>
</body>
</html>
`;
    res.send(html);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar el libro online.</p>');
  }
});

// -------------------- Rutas originales --------------------
// (Aquí van todas tus rutas originales: /, /autores, /autor, /sagas, /saga)
// ...mantener igual que tu código original, sin cambios

app.listen(PORT, ()=>console.log(`Servidor escuchando en puerto ${PORT}`));
