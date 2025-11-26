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

// CSS estilo Hogwarts mejorado
const css = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap');

body {
  font-family: 'Garamond', serif;
  margin:10px; padding:0;
  background:#1c1a13;
  background-image: url('https://i.imgur.com/qZp0rBg.png');
  background-size: cover;
  color:#f5e6c4;
}
h1 {
  text-align:center;
  font-size:45px;
  font-family: 'MedievalSharp', cursive;
  color:#d4af7f;
  margin-bottom:15px;
  text-shadow: 2px 2px 6px #000;
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
#grid {
  display:flex;
  flex-wrap: wrap;
  justify-content: center;
  gap:12px;
}
.book {
  display:flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  width:160px;
  min-height:220px;
  background: linear-gradient(145deg, #f5e6c4, #e8d7aa);
  padding:8px;
  border-radius:12px;
  border: 2px solid #d4af7f;
  text-align:center;
  word-wrap: break-word;
}
.book img {
  width:100px;
  height:150px;
  border-radius:6px;
  object-fit:cover;
  filter: sepia(0.4) contrast(1.1) brightness(0.95);
  margin-bottom:6px;
}
.title {
  font-size:14px;
  color:#3e2f1c;
  font-family: 'MedievalSharp', cursive;
  margin-bottom:6px;
}
.meta a {
  font-size:12px;
  text-decoration:none;
  color:#d4af7f;
}
.meta a:visited {
  color:#b5895e;
}
`;

// Función para listar todos los archivos con paginación
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

// Ruta principal
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
        : `<div style="width:100px;height:150px;background:#8b735e;border-radius:6px;">📖</div>`;
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
<title>Azkaban Reads</title>
<style>${css}</style>
</head>
<body>
<h1>🪄 Azkaban Reads</h1>

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
