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
  coverImages = fs.readdirSync(path.join(__dirname,'cover')).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// CSS estilo Hogwarts mágico
const css = `
body {
  font-family: 'Garamond', serif;
  margin:10px; padding:0;
  background: #1b1912; /* fondo biblioteca antigua */
  background-image: url('https://i.imgur.com/qZp0rBg.png'); /* sutil textura de pergamino */
  background-size: cover;
  color:#f5e6c4;
}
h1 {
  text-align:center;
  font-size:30px;
  color:#d4af7f; /* dorado viejo */
  margin-bottom:15px;
  text-shadow: 2px 2px 4px #000;
}
form {
  text-align:center;
  margin-bottom:15px;
}
input, select {
  padding:6px 10px;
  margin:0 5px;
  font-size:14px;
  border-radius:8px;
  border:1px solid #a67c4e;
  background:#f5e6c4;
  color:#3e2f1c;
}
.book {
  display:inline-block;
  width:100px;
  height:160px;
  margin:6px;
  vertical-align:top;
  background: linear-gradient(145deg, #f5e6c4, #e8d7aa);
  padding:5px;
  border-radius:12px;
  text-align:center;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 0 6px rgba(255,255,255,0.2);
  position: relative;
  clip-path: polygon(
    2% 0%, 98% 0%, 100% 3%, 100% 97%, 98% 100%, 2% 100%, 0% 97%, 0% 3%
  );
}
.book img {
  width:80px;
  height:120px;
  display:block;
  margin:0 auto 5px;
  border-radius:6px;
  object-fit:cover;
  filter: sepia(0.4) contrast(1.1) brightness(0.95);
}
.title {
  font-size:12px;
  color:#3e2f1c;
  overflow:hidden;
  height:36px;
}
.meta a {
  display:block;
  margin-top:3px;
  font-size:11px;
  text-decoration:none;
  color:#d4af7f;
}
`;

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
  } while(pageToken);

  return files;
}

function ordenarFiles(files, criterio) {
  let sorted = [...files];
  if(criterio === 'alfabetico')
    sorted.sort((a,b)=> a.name.localeCompare(b.name));
  else if(criterio === 'recientes')
    sorted.sort((a,b)=> new Date(b.createdTime)-new Date(a.createdTime));
  return sorted;
}

app.get('/', async (req, res) => {
  try {
    const query = (req.query.buscar || '').toLowerCase();
    const orden = req.query.ordenar || 'alfabetico';

    let files = await listAllFiles(folderId);

    if(query) {
      files = files.filter(f => f.name.toLowerCase().includes(query));
    }

    files = ordenarFiles(files, orden);

    const booksHtml = files.map(file => {
      const cover = coverImages.length ? coverImages[Math.floor(Math.random()*coverImages.length)] : null;
      const imgHtml = cover
        ? `<img src="${cover}" />`
        : `<div style="width:80px;height:120px;background:#8b735e;margin:0 auto;border-radius:4px;">📖</div>`;
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
<title>Mi Biblioteca Hogwarts</title>
<style>${css}</style>
</head>
<body>
<h1>🪄 Mi Biblioteca Hogwarts</h1>

<form method="get" action="/">
  <input type="search" name="buscar" value="${req.query.buscar || ''}" placeholder="Buscar título..." />
  <select name="ordenar">
    <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>Alfabético</option>
    <option value="recientes" ${orden==='recientes'?'selected':''}>Más recientes</option>
  </select>
</form>

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
