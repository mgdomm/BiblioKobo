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

// Leer imágenes cover locales
let coverImages = [];
try {
  // Solo tomamos archivos PNG para portadas
  coverImages = fs.readdirSync(path.join(__dirname,'cover'))
    .filter(f => f.endsWith('.png'))
    .map(f => `/cover/${f}`);
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
// ... (aquí va tu CSS actualizado que ya pusiste)
`;

// ------------------ FUNCIONES ------------------

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

// ------------------ renderBookPage ------------------

function renderBookPage({ libros, titlePage, tipo, nombre, req }) {
  const orden = req.query.ordenar || 'alfabetico';
  libros = ordenarBooks(libros, orden, tipo);

  const maxHeight = 180;
  const booksHtml = libros.map(book => {
    // Selección aleatoria de portada
    const cover = coverImages.length ? coverImages[Math.floor(Math.random()*coverImages.length)] : null;
    const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#333;border-radius:5px;">📖</div>`;
    return `
<div class="book" style="min-height:${maxHeight}px">
  ${imgHtml}
  <div class="title">${book.title}</div>
  <div class="author-span">${book.author}</div>
  ${book.saga?.number ? `<div class="number-span">#${book.saga.number}</div>` : ''}
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${book.id}" target="_blank">Descargar</a></div>
</div>`;
  }).join('');
  
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${titlePage}</title><style>${css}</style></head>
<body>

<div class="header-banner"></div>

<h1>${titlePage}</h1>

<div class="top-buttons">
  <a href="/" class="button">🪄 Libros</a>
  ${tipo==='autor'?'<a href="/sagas" class="button">Sagas</a>':'<a href="/autores" class="button">Autores</a>'}
</div>

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
}

// ------------------ RUTAS ------------------

// Página de inicio (Libros)
app.get('/', async (req, res) => {
  try {
    const query = (req.query.buscar || '').toLowerCase();
    const orden = req.query.ordenar || 'alfabetico';
    let files = await listAllFiles(folderId);

    actualizarBooksJSON(files);

    if(query) {
      files = files.filter(f => {
        const metadata = bookMetadata.find(b => b.id === f.id);
        const title = metadata ? metadata.title.toLowerCase() : f.name.toLowerCase();
        return title.includes(query);
      });
    }

    files = ordenarBooks(files, orden);

    const maxHeight = 180;
    const booksHtml = files.map(file => {
      const metadata = bookMetadata.find(b => b.id === file.id);
      if(!metadata) return '';
      const title = metadata.title;
      const author = metadata.author;
      // Selección aleatoria de portada
      const cover = coverImages.length ? coverImages[Math.floor(Math.random()*coverImages.length)] : null;
      const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#333;border-radius:5px;">📖</div>`;
      return `
<div class="book" style="min-height:${maxHeight}px">
  ${imgHtml}
  <div class="title">${title}</div>
  <div class="author"><span class="author-span">${author}</span></div>
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${file.id}" target="_blank">Descargar</a></div>
</div>`;
    }).join('');

    res.send(`
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Azkaban Reads</title><style>${css}</style></head>
<body>

<div class="header-banner"></div>

<h1>🪄 Azkaban Reads</h1>

<div class="top-buttons">
  <a href="/autores" class="button">Autores</a>
  <a href="/sagas" class="button">Sagas</a>
</div>

<form method="get" action="/">
<input type="search" name="buscar" value="${req.query.buscar || ''}" placeholder="Buscar título..." />
<select name="ordenar" onchange="this.form.submit()">
  <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>A→Z</option>
  <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Z→A</option>
  <option value="recientes" ${orden==='recientes'?'selected':''}>Recientes</option>
</select>
</form>

<div id="grid">${booksHtml}</div>

</body>
</html>`);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar libros.</p>');
  }
});

// Las rutas de autores, sagas, autor y saga se mantienen igual
// Solo cambia la asignación aleatoria de coverImages como ya hicimos en renderBookPage

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
