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
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap');
body { font-family: 'Garamond', serif; margin:0; padding:0; background:#000; color:#eee; text-align:center; }
.header-banner { position: sticky; top:0; width:100%; height:460px; background-size: cover; background-position: center; z-index:9999; -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0)); mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0)); transition: all 0.3s ease; }
.header-banner.fullscreen { height:100vh; background-size: cover; background-position: center; }
.top-buttons { text-align:center; margin-top:10px; }
.top-buttons a { display:inline-block; color:#fff; text-decoration:none; font-weight:bold; font-size:20px; padding:8px 16px; background:transparent; border:1px solid #fff; border-radius:6px; margin:4px; transition: all 0.2s ease; }
.top-buttons a:hover { background:#222; }
h1 { font-size:64px; font-family: 'MedievalSharp', cursive; color:#fff; margin:10px 0; }
form { margin-bottom:10px; }
input[type="search"], select { padding:6px 8px; margin:0 4px; font-size:14px; border-radius:6px; border:1px solid #555; background:#111; color:#fff; }
#grid { text-align:center; }
.book { display:inline-block; vertical-align:top; width:110px; min-height:160px; background:#111; padding:6px; border-radius:8px; border:1px solid #555; margin:4px; text-align:center; word-wrap:break-word; }
.book img { width:80px; height:120px; border-radius:5px; object-fit:cover; margin-bottom:4px; }
.title { font-size:12px; font-weight:700; color:#eee; font-family: 'MedievalSharp', cursive; margin-bottom:2px; }
.author a, .author-span { color:#ccc; font-size:11px; text-decoration:none; }
.number-span { color:#ccc; font-size:11px; }
.meta a { font-size:11px; font-weight:bold; text-decoration:none; color:#fff; background:#222; padding:3px 6px; border-radius:4px; display:inline-block; margin-top:3px; transition: all 0.2s ease; }
.meta a:hover { background:#444; }
a.button { display:inline-block; margin:10px; text-decoration:none; padding:14px 28px; background:#222; color:#fff; border-radius:8px; font-size:20px; font-weight:bold; transition: all 0.2s ease; }
a.button:hover { background:#444; }
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

function getCoverForBook(bookId) {
  if(coverImages.length === 0) return null;
  const index = bookId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % coverImages.length;
  return coverImages[index];
}

function ordenarBooks(books, criterio, tipo=null) {
  let sorted = [...books];
  if(tipo==='autor' || tipo==='saga') {
    if(criterio==='alfabetico')
      sorted.sort((a,b)=> a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
    else if(criterio==='alfabetico-desc')
      sorted.sort((a,b)=> b.title.toLowerCase().localeCompare(a.title.toLowerCase()));
    else if(criterio==='numero')
      sorted.sort((a,b)=> (a.saga?.number||0) - (b.saga?.number||0));
  } else {
    if(criterio==='alfabetico')
      sorted.sort((a,b)=> (bookMetadata.find(x=>x.id===a.id)?.title||a.name)
        .localeCompare(bookMetadata.find(x=>x.id===b.id)?.title||b.name));
    else if(criterio==='alfabetico-desc')
      sorted.sort((a,b)=> (bookMetadata.find(x=>x.id===b.id)?.title||b.name)
        .localeCompare(bookMetadata.find(x=>x.id===a.id)?.title||a.name));
    else if(criterio==='recientes')
      sorted.sort((a,b)=> new Date(b.createdTime)-new Date(a.createdTime));
  }
  return sorted;
}

// ------------------ RENDER ------------------

function renderBookPage({ libros, titlePage, tipo, nombre, req }) {
  const orden = req.query.ordenar || 'alfabetico';
  libros = ordenarBooks(libros, orden, tipo);
  const maxHeight = 180;

  let booksHtml = libros.map(book => {
    const cover = getCoverForBook(book.id);
    const imgHtml = cover
      ? `<img src="${cover}" />`
      : `<div style="width:80px;height:120px;background:#333;border-radius:5px;">📖</div>`;
    return `
      <div class="book" style="min-height:${maxHeight}px">
        ${imgHtml}
        <div class="title">${book.title}</div>
        <div class="author-span">${book.author}</div>
        ${book.saga?.number ? `<div class="number-span">#${book.saga.number}</div>` : ''}
        <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${book.id}" target="_blank">Descargar</a></div>
      </div>
    `;
  }).join('');

  if (!booksHtml || booksHtml.trim() === '') {
    booksHtml = `
      <div style="padding:40px;color:#eee;">
        <h2>¡Oh, qué desastre!</h2>
        <p style="font-size: 1.2em; line-height: 1.5;">
          <strong>Un prisionero de Azkaban murmura:</strong>
          "Claramente, el libro que buscas ha sido confiscado por el Ministerio por 'contenido altamente peligroso'... O tal vez, simplemente no existe. Vuelve cuando tu búsqueda sea menos patética."
        </p>
      </div>
    `;
  }

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><title>${titlePage}</title><style>${css}</style></head>
  <body>
    <div class="header-banner" style="background-image:url('/cover/secundarias/portada11.png');"></div>
    <h1>${titlePage}</h1>

    <div class="top-buttons">
      <a href="/libros" class="button">🪄 Libros</a>
      ${tipo==='autor'
        ? '<a href="/sagas" class="button">Sagas</a>'
        : '<a href="/autores" class="button">Autores</a>'}
    </div>

    <form method="get" action="/${tipo}">
      <select name="ordenar" onchange="this.form.submit()">
        <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>A→Z</option>
        <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Z→A</option>
        ${tipo==='saga'
          ? `<option value="numero" ${orden==='numero'?'selected':''}>#Número</option>`
          : ''}
      </select>
      <input type="hidden" name="name" value="${nombre}" />
    </form>

    <div id="grid">${booksHtml}</div>
    <p><a href="/${tipo==='autor'?'autores':'sagas'}" class="button">← Volver</a></p>
  </body>
  </html>`;
}

// ------------------ RUTAS ------------------

// Página de inicio
app.get('/', (req,res)=>{
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><title>Azkaban Reads</title><style>${css}</style></head>
    <body>
      <div class="header-banner fullscreen" style="background-image:url('/cover/portada/portada1.png');"></div>
      <h1>🪄 Azkaban Reads</h1>
      <div class="top-buttons">
        <a href="/libros" class="button">Libros</a>
        <a href="/autores" class="button">Autores</a>
        <a href="/sagas" class="button">Sagas</a>
      </div>
    </body>
    </html>
  `);
});

// Libros
app.get('/libros', async (req, res) => {
  try {
    const query = (req.query.buscar || '').trim().toLowerCase();
    const orden = req.query.ordenar || 'alfabetico';
    let files = await listAllFiles(folderId);
    actualizarBooksJSON(files);

    if(query) {
      files = files.filter(f => {
        const metadata = bookMetadata.find(b => b.id === f.id);
        const title = (metadata?.title || f.name || '').toLowerCase();
        const author = (metadata?.author || '').toLowerCase();
        return title.includes(query) || author.includes(query);
      });
    }

    files = ordenarBooks(files, orden);

    const maxHeight = 180;

    let booksHtml = files.map(file => {
      const metadata = bookMetadata.find(b => b.id === file.id);
      if(!metadata) return '';
      const cover = getCoverForBook(file.id);
      const imgHtml = cover
        ? `<img src="${cover}" />`
        : `<div style="width:80px;height:120px;background:#333;border-radius:5px;">📖</div>`;
      return `
        <div class="book" style="min-height:${maxHeight}px">
          ${imgHtml}
          <div class="title">${metadata.title}</div>
          <div class="author-span">${metadata.author}</div>
          <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${file.id}" target="_blank">Descargar</a></div>
        </div>
      `;
    }).join('');

    if (!booksHtml || booksHtml.trim() === '') {
      booksHtml = `
        <div style="padding:40px;color:#eee;">
          <h2>¡Oh, qué desastre!</h2>
          <p style="font-size: 1.2em; line-height: 1.5;">
            <strong>Un prisionero de Azkaban murmura:</strong>
            "Claramente, el libro que buscas ha sido confiscado por el Ministerio por 'contenido altamente peligroso'... O tal vez, simplemente no existe. Vuelve cuando tu búsqueda sea menos patética."
          </p>
        </div>
      `;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>Azkaban Reads</title><style>${css}</style></head>
      <body>
        <div class="header-banner" style="background-image:url('/cover/secundarias/portada11.png');"></div>
        <h1>🪄 Libros</h1>
        <div class="top-buttons">
          <a href="/" class="button">Inicio</a>
          <a href="/autores" class="button">Autores</a>
          <a href="/sagas" class="button">Sagas</a>
        </div>

        <form method="get" action="/libros">
          <input type="search" name="buscar" value="${req.query.buscar || ''}" placeholder="Buscar título..." />
          <select name="ordenar" onchange="this.form.submit()">
            <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>A→Z</option>
            <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Z→A</option>
            <option value="recientes" ${orden==='recientes'?'selected':''}>Recientes</option>
          </select>
        </form>

        <div id="grid">${booksHtml}</div>
      </body>
      </html>
    `);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar libros.</p>');
  }
});

// Autores
app.get('/autores', (req, res) => {
  const autores = [...new Set(bookMetadata.map(b => b.author).filter(a => a))].sort();
  const authorsHtml = autores.map(a => `
    <div class="book" style="min-height:100px">
      <div class="title">${a}</div>
      <div class="meta"><a href="/autor?name=${encodeURIComponent(a)}">Ver libros</a></div>
    </div>
  `).join('');
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><title>Autores</title><style>${css}</style></head>
  <body>
    <div class="header-banner" style="background-image:url('/cover/secundarias/portada11.png');"></div>
    <h1>Autores</h1>
    <div class="top-buttons">
      <a href="/" class="button">Inicio</a>
      <a href="/libros" class="button">Libros</a>
      <a href="/sagas" class="button">Sagas</a>
    </div>
    <div id="grid">${authorsHtml}</div>
    <p><a href="/libros" class="button">← Volver</a></p>
  </body>
  </html>`);
});

// Las rutas /autor, /sagas y /saga se mantienen igual que antes
app.get('/autor', (req, res) => {
  const nombreAutor = req.query.name;
  if(!nombreAutor) return res.redirect('/autores');
  const libros = bookMetadata.filter(b => b.author === nombreAutor);
  res.send(renderBookPage({ libros, titlePage: `Libros de ${nombreAutor}`, tipo: 'autor', nombre: nombreAutor, req }));
});

app.get('/sagas', (req, res) => {
  const sagas = [...new Set(bookMetadata.map(b => b.saga?.name).filter(a => a))].sort();
  const sagasHtml = sagas.map(s => `
    <div class="book" style="min-height:100px">
      <div class="title">${s}</div>
      <div class="meta"><a href="/saga?name=${encodeURIComponent(s)}">Ver libros</a></div>
    </div>
  `).join('');
  res.send(`
  <!DOCTYPE html>
  <html lang="es">
  <head><meta charset="UTF-8"><title>Sagas</title><style>${css}</style></head>
  <body>
    <div class="header-banner" style="background-image:url('/cover/secundarias/portada11.png');"></div>
    <h1>Sagas</h1>
    <div class="top-buttons">
      <a href="/" class="button">Inicio</a>
      <a href="/libros" class="button">Libros</a>
      <a href="/autores" class="button">Autores</a>
    </div>
    <div id="grid">${sagasHtml}</div>
    <p><a href="/libros" class="button">← Volver</a></p>
  </body>
  </html>`);
});

app.get('/saga', (req, res) => {
  const nombreSaga = req.query.name;
  if(!nombreSaga) return res.redirect('/sagas');
  const libros = bookMetadata.filter(b => b.saga?.name === nombreSaga);
  res.send(renderBookPage({ libros, titlePage: `Libros de ${nombreSaga}`, tipo: 'saga', nombre: nombreSaga, req }));
});

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
