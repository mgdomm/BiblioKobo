const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

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
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

// Leer imágenes cover locales (solo .png)
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname, 'cover'))
    .filter(f => f.endsWith('.png'))
    .map(f => `/cover/${f}`);
} catch (err) {
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
} catch (err) {
  console.warn('Error leyendo books.json. Se usará un arreglo vacío.');
  bookMetadata = [];
}

// ------------------ CSS ------------------
const css = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap');
body { margin:0; padding:0 0 40px 0; background:#000; color:#eee; font-family:Garamond, serif; }
/* Top banner variations */
.header-banner { background-size:cover; background-position:center; overflow:hidden; }
.header-banner.top { position:fixed; top:0; left:0; right:0; height:300px; z-index:1; background-position: center 50%; background-size:cover; }
.header-banner.home { position:relative; height:100vh; background-position: center 50%; background-size:cover; }
.header-banner::after { content:""; position:absolute; left:0; right:0; bottom:0; height:40%; background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.95) 100%); pointer-events:none; }

.overlay { display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding-bottom:10px; text-align:center; }
.overlay.top { position:fixed; top:0; left:0; width:100%; height:300px; z-index:2; }
.overlay.home { position:absolute; top:0; left:0; width:100%; height:100vh; z-index:2; display:flex; justify-content:center; align-items:center; }

h1 { font-family:'MedievalSharp', cursive; font-size:48px; color:#fff; margin:0; text-shadow: 0 2px 6px rgba(0,0,0,0.9); }

.top-buttons { display:flex; justify-content:center; flex-wrap:wrap; margin-bottom:6px; }
/* primary buttons: visible, subtle bg, no harsh border */
.top-buttons a { font-family:'MedievalSharp', cursive; font-size:20px; color:#fff; text-decoration:none; border-radius:6px; padding:6px 12px; margin:2px; background:rgba(255,255,255,0.06); transition:0.2s; }
.top-buttons a:hover { background:rgba(255,255,255,0.12); }
.top-buttons.secondary { position:absolute; top:10px; right:10px; font-size:16px; }
/* secondary (Inicio) should be plain text, no border */
.top-buttons.secondary a { color:#fff; text-decoration:none; border:none; padding:4px 8px; background:transparent; font-size:16px; }

form { margin:20px 0; text-align:center; }
input[type="search"], select { padding:6px 8px; margin:0 4px; font-size:14px; border-radius:6px; border:1px solid #555; background:#111; color:#fff; }

#grid { text-align:center; overflow-y:auto; padding:12px 8px 40px 8px; }
.book { display:inline-block; vertical-align:top; width:110px; min-height:160px; background:rgba(17,17,17,0.9); padding:6px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); margin:4px; text-align:center; word-wrap:break-word; transition:opacity 0.3s, transform 0.2s; }
.book img { width:80px; height:120px; border-radius:5px; object-fit:cover; margin-bottom:4px; }
.title { font-size:12px; font-weight:700; color:#eee; font-family:'MedievalSharp', cursive; margin-bottom:2px; }
.author-span a, .number-span a { color:#fff; text-decoration:none; font-family:'MedievalSharp', cursive; font-size:12px; font-weight:400; }
.author-span, .number-span { font-size:12px; color:#fff; font-family:'MedievalSharp', cursive; font-weight:400; }
.book { display:inline-block; vertical-align:top; width:130px; min-height:180px; background:linear-gradient(180deg, rgba(18,18,18,0.92), rgba(12,12,12,0.9)); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.04); margin:6px; text-align:center; word-wrap:break-word; transition:opacity 0.3s, transform 0.15s; box-shadow:0 6px 18px rgba(0,0,0,0.6); }
.book img { width:90px; height:140px; border-radius:6px; object-fit:cover; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto; }
.title { font-size:14px; font-weight:700; color:#fff; font-family:'MedievalSharp', cursive; margin:0 0 6px 0; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.04); }
.title a { color: inherit; text-decoration: none; display:block; padding-bottom:6px; }
.author-span, .number-span { font-size:12px; color:#ddd; font-family:'MedievalSharp', cursive; font-weight:400; display:block; margin-top:6px; }
.author-span a { color:#fff; text-decoration:none; font-style:italic; font-weight:400; }
.number-span a { color:#19E6D6; text-decoration:none; font-weight:600; font-size:11px; text-transform:uppercase; }
.meta a { font-size:11px; font-weight:bold; text-decoration:none; color:#fff; background:rgba(34,34,34,0.7); padding:3px 6px; border-radius:4px; display:inline-block; margin-top:3px; transition:0.2s; }
.meta a:hover { background:rgba(68,68,68,0.9); }
.author-span a:hover, .number-span a:hover { color:#fff; text-decoration:none; opacity:0.9; }
a.button { display:inline-block; margin:10px; text-decoration:none; padding:14px 28px; background:#222; color:#fff; border-radius:8px; font-size:20px; font-weight:bold; transition:0.2s; }
a.button:hover { background:#444; }
/* ensure content sits below fixed top banner */
body { padding-top:300px; }
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
      const base = f.name.replace(/\.[^/.]+$/, "");
      const parts = base.split(' - ');
      const title = parts[0]?.trim() || f.name;
      const author = parts[1]?.trim() || 'Desconocido';
      let saga = null;
      if (parts[2]) {
        const sagaMatch = parts[2].match(/^(.*?)(?:\s*#(\d+))?$/);
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

function getCoverForBook(bookId) {
  if (coverImages.length === 0) return null;
  const index = bookId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % coverImages.length;
  return coverImages[index];
}

// ------------------ SINOPSIS FETCH ------------------
async function fetchSynopsis(title, author) {
  // Use Open Library to try to fetch a description
  try {
    const sUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=5`;
    const sr = await axios.get(sUrl, { timeout: 5000 });
    const docs = sr.data.docs || [];
    if (docs.length) {
      const doc = docs[0];
      // try work key
      const workKey = doc.key || doc.edition_key && `/works/${doc.edition_key[0]}`;
      // if work key present, fetch work details
      if (doc.key) {
        const key = doc.key.startsWith('/works/') ? doc.key : `/works/${doc.key}`;
        try {
          const wr = await axios.get(`https://openlibrary.org${key}.json`, { timeout: 5000 });
          const desc = wr.data.description;
          if (desc) return (typeof desc === 'string') ? desc : (desc.value || null);
        } catch (e) {
          // ignore and continue
        }
      }
      // try available description fields on doc
      if (doc.first_sentence) return (typeof doc.first_sentence === 'string') ? doc.first_sentence : (doc.first_sentence.join ? doc.first_sentence.join(' ') : JSON.stringify(doc.first_sentence));
    }
  } catch (err) {
    console.warn('OpenLibrary failed:', err.message || err);
  }

  return null;
}

function ordenarBooks(books, criterio, tipo = null) {
  let sorted = [...books];
  if (tipo === 'autor' || tipo === 'saga') {
    if (criterio === 'alfabetico') sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
    else if (criterio === 'alfabetico-desc') sorted.sort((a, b) => b.title.toLowerCase().localeCompare(a.title.toLowerCase()));
    else if (criterio === 'numero') sorted.sort((a, b) => (a.saga?.number || 0) - (b.saga?.number || 0));
    else if (criterio === 'recientes') sorted.sort((a, b) => new Date(b.createdTime || 0) - new Date(a.createdTime || 0));
  } else {
    if (criterio === 'alfabetico') sorted.sort((a, b) => (bookMetadata.find(x => x.id === a.id)?.title || a.name)
      .localeCompare(bookMetadata.find(x => x.id === b.id)?.title || b.name));
    else if (criterio === 'alfabetico-desc') sorted.sort((a, b) => (bookMetadata.find(x => x.id === b.id)?.title || b.name)
      .localeCompare(bookMetadata.find(x => x.id === a.id)?.title || a.name));
    else if (criterio === 'recientes') sorted.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
  }
  return sorted;
}

// ------------------ RENDER ------------------
function renderBookPage({ libros, titlePage, tipo, nombre, req, noResultsHtml }) {
  const orden = (req && req.query.ordenar) || 'alfabetico';
  libros = ordenarBooks(libros, orden, tipo);
  const maxHeight = 180;
  let booksHtml = libros.map(book => {
    const cover = getCoverForBook(book.id);
    const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#333;border-radius:5px;"></div>`;
    const title = book.title || (book.name ? book.name.replace(/\.[^/.]+$/, "") : 'Sin título');
    const author = book.author || 'Desconocido';
    const sagaName = book.saga?.name || '';
    const sagaHtml = sagaName ? `<div class="number-span"><a href="/saga?name=${encodeURIComponent(sagaName)}">${sagaName}</a></div>` : '';
    const authorHtml = `<div class="author-span"><a href="/autor?name=${encodeURIComponent(author)}">${author}</a></div>`;
    // link image and title to detail page
    const imgLink = `<a href="/libro?id=${encodeURIComponent(book.id)}">${imgHtml}</a>`;
    const titleLink = `<a href="/libro?id=${encodeURIComponent(book.id)}">${title}</a>`;
    return `<div class="book" style="min-height:${maxHeight}px">${imgLink}<div class="title">${titleLink}</div>${authorHtml}${sagaHtml}<div class="meta"><a href="/download?id=${encodeURIComponent(book.id)}">Descargar</a></div></div>`;
  }).join('');

  if (!booksHtml || booksHtml.trim() === '') {
    booksHtml = noResultsHtml || `<div style="padding:40px;color:#eee;"><h2>¡Oh, qué desastre!</h2><p style="font-size: 1.2em; line-height: 1.5;"><strong>Un prisionero de Azkaban murmura:</strong> "El libro no existe o fue confiscado. Vuelve luego."</p></div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>${titlePage}</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1>${titlePage}</h1>
    <div class="top-buttons">
      ${tipo === 'libros' ? '<a href="/sagas">Sagas</a><a href="/autores">Autores</a>' : (tipo === 'autor' ? '<a href="/sagas">Sagas</a><a href="/libros">Libros</a>' : '<a href="/autores">Autores</a><a href="/libros">Libros</a>')}
    </div>
  </div>
  <form method="get" action="/${tipo}" style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;">
    <div style="display:flex;gap:8px;align-items:center;"><input type="search" name="buscar" placeholder="Buscar título o autor" value="${req && req.query.buscar ? req.query.buscar.replace(/"/g,'&quot;') : ''}" /><button type="submit">Buscar</button></div>
    <div style="margin-top:6px">
      <select id="orden" name="ordenar" onchange="this.form.submit()" style="width:auto;min-width:0;padding:4px 8px;border-radius:6px;">
        <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>A→Z</option>
        <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Z→A</option>
        <option value="recientes" ${orden==='recientes'?'selected':''}>Más recientes</option>
        ${tipo==='saga'?`<option value="numero" ${orden==='numero'?'selected':''}>#Número</option>`:''}
      </select>
    </div>
    <input type="hidden" name="name" value="${nombre}" />
  </form>
  <div id="grid">${booksHtml}</div>
  <p><a href="/${tipo==='autor'?'autores':'sagas'}" class="button">← Volver</a></p>

  <!-- Script para fade por línea -->
  <script>
    function applyRowFade() {
      const headerHeight = 300;
      const fadeLength = headerHeight * 0.4; // 40% of header
      const minOpacity = 0.2;
      const books = Array.from(document.querySelectorAll('.book'));
      if (!books.length) return;
      const rows = {};
      books.forEach(b => {
        const top = Math.round(b.getBoundingClientRect().top);
        if (!rows[top]) rows[top] = [];
        rows[top].push(b);
      });
      const rowTops = Object.keys(rows).map(Number).sort((a,b)=>a-b);
      rowTops.forEach(top => {
        const distance = top - headerHeight;
        let opacity = 1;
        if (distance <= 0) opacity = minOpacity;
        else if (distance < fadeLength) opacity = Math.max(minOpacity, distance / fadeLength);
        else opacity = 1;
        rows[top].forEach(el => el.style.opacity = opacity);
      });
      const firstRowTop = rowTops.length ? rowTops[0] : Infinity;
      const btns = document.querySelectorAll('.top-buttons a');
      let btnOpacity = 1;
      const dist = firstRowTop - headerHeight;
      if (dist <= 0) btnOpacity = minOpacity;
      else if (dist < fadeLength) btnOpacity = Math.max(minOpacity, dist / fadeLength);
      else btnOpacity = 1;
      btns.forEach(b=>b.style.opacity = btnOpacity);
    }
    document.addEventListener('scroll', applyRowFade);
    window.addEventListener('resize', applyRowFade);
    document.addEventListener('DOMContentLoaded', applyRowFade);
  </script>
</body>
</html>`;
}

// ------------------ RUTAS ------------------

// Página de inicio
app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html>
<html lang="es">
  <head><meta charset="UTF-8"><title>Azkaban Reads</title><style>${css}</style><style>body{padding-top:0;}</style></head>
<body>
  <div class="header-banner home" style="height:100vh; background-image:url('/cover/portada/portada1.png');"></div>
  <div class="overlay home" style="justify-content:center;">
    <h1>Azkaban Reads</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/autores">Autores</a>
      <a href="/sagas">Sagas</a>
    </div>
  </div>
</body>
</html>`);
});

// Libros
app.get('/libros', async (req,res)=>{
  try {
    const query = (req.query.buscar||'').trim().toLowerCase();
    const orden = req.query.ordenar||'alfabetico';
    let files = await listAllFiles(folderId);
    actualizarBooksJSON(files);

    if(query){
      files = files.filter(f=>{
        const metadata = bookMetadata.find(b=>b.id===f.id);
        const title = (metadata?.title||f.name||'').toLowerCase();
        const author = (metadata?.author||'').toLowerCase();
        return title.includes(query) || author.includes(query);
      });
    }

    files = ordenarBooks(files, orden);
    // Build an array of metadata-shaped objects for rendering so titles/authors/sagas are available
    const librosForRender = files.map(f => {
      const meta = bookMetadata.find(b => b.id === f.id);
      if (meta) return { ...meta, id: f.id };
      // fallback: parse filename like in actualizarBooksJSON
      const base = (f.name || '').replace(/\.[^/.]+$/, "");
      const parts = base.split(' - ');
      const title = parts[0]?.trim() || f.name || 'Sin título';
      const author = parts[1]?.trim() || 'Desconocido';
      let saga = null;
      if (parts[2]) {
        const sagaMatch = parts[2].match(/^(.*?)(?:\s*#(\d+))?$/);
        if (sagaMatch) {
          saga = { name: sagaMatch[1].trim() };
          if (sagaMatch[2]) saga.number = parseInt(sagaMatch[2], 10);
        }
      }
      return { id: f.id, title, author, saga };
    }).filter(x => x);

    const noResultsHtml = `<div style="padding:40px;color:#eee;"><h2>¡Oh, qué desastre!</h2><p style="font-size: 1.2em; line-height: 1.5;"><strong>Un prisionero de Azkaban murmura:</strong> "Claramente, el libro que buscas ha sido confiscado por el Ministerio por 'contenido altamente peligroso'... O tal vez, simplemente no existe. Vuelve cuando tu búsqueda sea menos patética."</p></div>`;
    res.send(renderBookPage({libros:librosForRender,titlePage:'Libros',tipo:'libros',nombre:'libros',req,noResultsHtml}));
  } catch(err){console.error(err); res.send('<p>Error al cargar libros.</p>');}
});

// Autores
app.get('/autores', (req,res)=>{
  const query = (req.query.buscar||'').trim().toLowerCase();
  let autores = [...new Set(bookMetadata.map(b=>b.author).filter(a=>a))].sort();
  if(query) autores = autores.filter(a=>a.toLowerCase().includes(query));
  const authorsHtml = autores.map(a=>`<div class="book" style="min-height:100px"><div class="title">${a}</div><div class="meta"><a href="/autor?name=${encodeURIComponent(a)}">Ver libros</a></div></div>`).join('');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Autores</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1>Autores</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/sagas">Sagas</a>
    </div>
  </div>
  <form method="get" action="/autores" style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;">
    <div style="display:flex;gap:8px;align-items:center;"><input type="search" name="buscar" placeholder="Buscar autor" value="${req.query.buscar?req.query.buscar.replace(/\"/g,'&quot;'):''}" /><button type="submit">Buscar</button></div>
    <div style="margin-top:6px">
      <select id="orden-autores" name="ordenar" onchange="this.form.submit()" style="width:auto;min-width:0;padding:4px 8px;border-radius:6px;">
        <option value="alfabetico">A→Z</option>
        <option value="alfabetico-desc">Z→A</option>
        <option value="recientes">Más recientes</option>
      </select>
    </div>
  </form>
  <div id="grid">${authorsHtml}</div>
  <p><a href="/libros" class="button">← Volver</a></p>

  <script>
    function applyRowFade() {
      const headerHeight = 300;
      const fadeLength = headerHeight * 0.4;
      const minOpacity = 0.2;
      const books = Array.from(document.querySelectorAll('.book'));
      if (!books.length) return;
      const rows = {};
      books.forEach(b => {
        const top = Math.round(b.getBoundingClientRect().top);
        if (!rows[top]) rows[top] = [];
        rows[top].push(b);
      });
      const rowTops = Object.keys(rows).map(Number).sort((a,b)=>a-b);
      rowTops.forEach(top => {
        const distance = top - headerHeight;
        let opacity = 1;
        if (distance <= 0) opacity = minOpacity;
        else if (distance < fadeLength) opacity = Math.max(minOpacity, distance / fadeLength);
        else opacity = 1;
        rows[top].forEach(el => el.style.opacity = opacity);
      });
      const firstRowTop = rowTops.length ? rowTops[0] : Infinity;
      const btns = document.querySelectorAll('.top-buttons a');
      let btnOpacity = 1;
      const dist = firstRowTop - headerHeight;
      if (dist <= 0) btnOpacity = minOpacity;
      else if (dist < fadeLength) btnOpacity = Math.max(minOpacity, dist / fadeLength);
      else btnOpacity = 1;
      btns.forEach(b=>b.style.opacity = btnOpacity);
    }
    document.addEventListener('scroll', applyRowFade);
    window.addEventListener('resize', applyRowFade);
    document.addEventListener('DOMContentLoaded', applyRowFade);
  </script>
</body>
</html>`);
});

// Sagas
app.get('/sagas', (req,res)=>{
  const query = (req.query.buscar||'').trim().toLowerCase();
  let sagas = [...new Set(bookMetadata.map(b=>b.saga?.name).filter(a=>a))].sort();
  if(query) sagas = sagas.filter(s=>s.toLowerCase().includes(query));
  const sagasHtml = sagas.map(s=>`<div class="book" style="min-height:100px"><div class="title">${s}</div><div class="meta"><a href="/saga?name=${encodeURIComponent(s)}">Ver libros</a></div></div>`).join('');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Sagas</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1>Sagas</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/autores">Autores</a>
    </div>
  </div>
  <form method="get" action="/sagas" style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:12px;">
    <div style="display:flex;gap:8px;align-items:center;"><input type="search" name="buscar" placeholder="Buscar saga" value="${req.query.buscar?req.query.buscar.replace(/\"/g,'&quot;'):''}" /><button type="submit">Buscar</button></div>
    <div style="margin-top:6px">
      <select id="orden-sagas" name="ordenar" onchange="this.form.submit()" style="width:auto;min-width:0;padding:4px 8px;border-radius:6px;">
        <option value="alfabetico">A→Z</option>
        <option value="alfabetico-desc">Z→A</option>
        <option value="recientes">Más recientes</option>
      </select>
    </div>
  </form>
  <div id="grid">${sagasHtml}</div>
  <p><a href="/libros" class="button">← Volver</a></p>

  <script>
    function applyRowFade() {
      const headerHeight = 300;
      const fadeLength = headerHeight * 0.4;
      const minOpacity = 0.2;
      const books = Array.from(document.querySelectorAll('.book'));
      if (!books.length) return;
      const rows = {};
      books.forEach(b => {
        const top = Math.round(b.getBoundingClientRect().top);
        if (!rows[top]) rows[top] = [];
        rows[top].push(b);
      });
      const rowTops = Object.keys(rows).map(Number).sort((a,b)=>a-b);
      rowTops.forEach(top => {
        const distance = top - headerHeight;
        let opacity = 1;
        if (distance <= 0) opacity = minOpacity;
        else if (distance < fadeLength) opacity = Math.max(minOpacity, distance / fadeLength);
        else opacity = 1;
        rows[top].forEach(el => el.style.opacity = opacity);
      });
      const firstRowTop = rowTops.length ? rowTops[0] : Infinity;
      const btns = document.querySelectorAll('.top-buttons a');
      let btnOpacity = 1;
      const dist = firstRowTop - headerHeight;
      if (dist <= 0) btnOpacity = minOpacity;
      else if (dist < fadeLength) btnOpacity = Math.max(minOpacity, dist / fadeLength);
      else btnOpacity = 1;
      btns.forEach(b=>b.style.opacity = btnOpacity);
    }
    document.addEventListener('scroll', applyRowFade);
    window.addEventListener('resize', applyRowFade);
    document.addEventListener('DOMContentLoaded', applyRowFade);
  </script>
</body>
</html>`);
});

// Autor individual
app.get('/autor', (req,res)=>{
  const nombreAutor = req.query.name;
  if(!nombreAutor) return res.redirect('/autores');
  const libros = bookMetadata.filter(b=>b.author===nombreAutor);
  res.send(renderBookPage({libros,titlePage:`Libros de ${nombreAutor}`,tipo:'autor',nombre:nombreAutor,req}));
});

// Saga individual
app.get('/saga', (req,res)=>{
  const nombreSaga = req.query.name;
  if(!nombreSaga) return res.redirect('/sagas');
  const libros = bookMetadata.filter(b=>b.saga?.name===nombreSaga);
  res.send(renderBookPage({libros,titlePage:`Libros de ${nombreSaga}`,tipo:'saga',nombre:nombreSaga,req}));
});

// Libro individual -> muestra sinopsis + portada
app.get('/libro', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect('/libros');
  const meta = bookMetadata.find(b => b.id === id);
  const cover = getCoverForBook(id);
  const title = meta?.title || 'Sin título';
  const author = meta?.author || 'Desconocido';
  const saga = meta?.saga?.name || null;
  let synopsis = null;
  try {
    synopsis = await fetchSynopsis(title, author);
  } catch (err) {
    console.error('Error fetching synopsis:', err);
  }

  const synopsisHtml = synopsis ? `<div style="max-width:760px;margin:18px auto;color:#ddd;line-height:1.5;">${synopsis}</div>` : `<div style="max-width:760px;margin:18px auto;color:#ddd;line-height:1.5;">No se encontró sinopsis automática.</div>`;

  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('${cover || '/cover/secuendarias/portada11.png'}');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1>${title}</h1>
    <div class="top-buttons"><a href="/libros">Libros</a><a href="/autores">Autores</a></div>
  </div>
  <div style="max-width:900px;margin:20px auto;padding:12px;color:#fff;">
    <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;">
      <div style="flex:0 0 200px;text-align:center;"><img src="${cover || '/cover/portada/portada1.png'}" style="width:180px;height:auto;border-radius:8px;display:block;margin:0 auto;"/></div>
      <div style="flex:1 1 400px;">
        <h2 style="margin:0 0 8px;color:#fff;font-family:'MedievalSharp',cursive;">${title}</h2>
        <div style="color:#ddd;margin-bottom:6px;">Autor: <a href="/autor?name=${encodeURIComponent(author)}" style="color:#fff;text-decoration:none;">${author}</a></div>
        ${saga?`<div style="color:#19E6D6;margin-bottom:12px;">Saga: <a href="/saga?name=${encodeURIComponent(saga)}" style="color:#19E6D6;text-decoration:none;">${saga}</a></div>`:''}
        <p><a href="/download?id=${encodeURIComponent(id)}" class="button">Descargar</a></p>
      </div>
    </div>
    ${synopsisHtml}
  </div>
</body>
</html>`);
});

// Iniciar servidor
// Ruta para descargar archivos desde Google Drive y forzar descarga en la misma pestaña
app.get('/download', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Falta id');
  try {
    // obtener metadatos para el nombre y mimeType
    const meta = await drive.files.get({ fileId: id, fields: 'name,mimeType' });
    const filename = (meta.data && meta.data.name) ? meta.data.name.replace(/\"/g, '') : `file-${id}`;
    const mime = (meta.data && meta.data.mimeType) ? meta.data.mimeType : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // stream del contenido
    const r = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
    r.data.on('error', err => {
      console.error('Stream error:', err);
      try { res.status(500).end(); } catch (e) {}
    });
    r.data.pipe(res);
  } catch (err) {
    console.error('Download failed, falling back to Drive URL:', err && err.message ? err.message : err);
    // fallback: redirect al enlace público de Drive
    return res.redirect(`https://drive.google.com/uc?export=download&id=${id}`);
  }
});

app.listen(PORT,()=>console.log(`Servidor escuchando en puerto ${PORT}`));
