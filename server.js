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

// Leer JSON con metadata de libros
let bookMetadata = [];
try {
  bookMetadata = JSON.parse(fs.readFileSync(path.join(__dirname, 'books.json')));
} catch(err) {
  console.warn('No se encontró books.json o está mal formado.');
}

// CSS global compatible con Kobo
const css = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap');

body {
  font-family: 'Garamond', serif;
  margin:10px;
  padding:0;
  background:#1c1a13;
  color:#f5e6c4;
}

h1 {
  text-align:center;
  font-size:45px;
  font-family: 'MedievalSharp', cursive;
  color:#d4af7f;
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

/* Grid estilo Kobo: inline-block centrado */
#grid {
  text-align:center;
}

.card {
  display:inline-block;
  vertical-align: top;
  width:160px;
  min-height:60px;
  background: #e8d7aa;
  padding:8px;
  border-radius:12px;
  border: 2px solid #d4af7f;
  margin:6px;
  text-align:center;
  word-wrap: break-word;
}

.card img {
  width:100px;
  height:150px;
  border-radius:6px;
  object-fit:cover;
  margin-bottom:6px;
}

.title {
  font-size:15px;
  font-weight:700;
  color:#3e2f1c;
  font-family: 'MedievalSharp', cursive;
  margin-bottom:3px;
  text-shadow: 1px 1px 0 #fff, -1px -1px 0 #000;
}

.author {
  font-size:12px;
  color:#5a4632;
  margin-bottom:6px;
  font-family: 'Garamond', serif;
}

.meta a {
  font-size:14px;
  font-weight:bold;
  text-decoration:none;
  color:#fff;
  background: #b5884e;
  padding:6px 12px;
  border-radius:8px;
  display:inline-block;
  margin-top:6px;
  box-shadow: inset 0 -2px 3px rgba(0,0,0,0.4), 2px 4px 6px rgba(0,0,0,0.5);
  transition: all 0.2s ease;
}

.meta a:hover {
  background:#8b5f2c;
  box-shadow: inset 0 -2px 3px rgba(0,0,0,0.5), 2px 6px 10px rgba(0,0,0,0.6);
  transform: translateY(-1px);
}

.meta a:visited {
  color:#fff;
}
`;

// Función para listar archivos de Drive
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

// Página principal: lista de libros
app.get('/', async (req, res) => {
  try {
    const query = (req.query.buscar || '').toLowerCase();
    const orden = req.query.ordenar || 'alfabetico';

    let files = await listAllFiles(folderId);

    if(query) {
      files = files.filter(f => f.name.toLowerCase().includes(query));
    }

    files = ordenarFiles(files, orden);

    const heights
