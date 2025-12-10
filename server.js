const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const archiver = require('archiver');
const compression = require('compression');
const multer = require('multer');
const FormData = require('form-data');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY || 'AIzaSyA4Rm0J2mdQuCK7MChxJP-SnMrV9HVrnGo';

// Middleware para compresión gzip
app.use(compression());

app.use(express.json());

// Middleware para archivos multipart
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Validar solo por extensión .epub (el mimetype puede variar según navegador)
    if (file.originalname.toLowerCase().endsWith('.epub')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .epub'), false);
    }
  }
});

// Servir carpeta cover con caché agresivo
app.use('/cover', express.static(path.join(__dirname, 'cover'), {
  maxAge: '1d',
  etag: false
}));

// Ruta para test de botones
app.get('/test-buttons', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Test Botones Simples</title>
<style>
body { background: #1a1a1a; color: #fff; font-family: Arial; padding: 40px; }
button { padding: 15px 30px; margin: 10px; cursor: pointer; font-size: 16px; }
.btn1 { background: #19E6D6; color: #000; border: none; border-radius: 5px; }
.btn1:hover { background: #00d4d4; }
.result { margin-top: 30px; padding: 20px; background: #222; border: 2px solid #19E6D6; border-radius: 5px; }
</style>
</head>
<body>

<h1>Test de Botones</h1>
<p>Haz clic en los botones para probar si los onclick funcionan:</p>

<button class="btn1" onclick="test1()">TEST 1: Alert Simple</button>
<button class="btn1" onclick="test2()">TEST 2: Cambiar Color</button>
<button class="btn1" onclick="test3()">TEST 3: Mostrar Hora</button>

<div class="result">
  <h3>Resultado:</h3>
  <p id="resultado">Haz clic en un botón arriba...</p>
</div>

<script>
function test1() {
  alert('✅ TEST 1 FUNCIONÓ! Los onclick SÍ responden.');
  document.getElementById('resultado').textContent = '✅ TEST 1 ejecutado - onclick funciona';
  document.getElementById('resultado').style.color = '#19E6D6';
}

function test2() {
  document.body.style.background = '#2a1a3a';
  document.getElementById('resultado').textContent = '✅ TEST 2 ejecutado - DOM puede ser modificado';
  document.getElementById('resultado').style.color = '#ffff00';
}

function test3() {
  const hora = new Date().toLocaleTimeString('es-ES');
  document.getElementById('resultado').innerHTML = '✅ TEST 3 ejecutado<br>Hora actual: ' + hora;
  document.getElementById('resultado').style.color = '#00ff00';
}

console.log('Script cargado. Funciones disponibles.');
</script>

</body>
</html>`);
});

// Auth: prioriza OAuth si existe, sino usa Service Account
const OAUTH_CREDENTIALS = path.join(__dirname, 'oauth-credentials.json');
const OAUTH_TOKEN = path.join(__dirname, 'oauth-token.json');
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

const hasOAuth = fs.existsSync(OAUTH_TOKEN) && fs.existsSync(OAUTH_CREDENTIALS);
const hasServiceAccount = fs.existsSync(SERVICE_ACCOUNT_FILE);

let driveUpload = null; // se usa para subidas
let driveRead = null;   // se usa para listados/descargas

if (hasOAuth) {
  // Usar OAuth (cuenta personal)
  const credentials = JSON.parse(fs.readFileSync(OAUTH_CREDENTIALS));
  const token = JSON.parse(fs.readFileSync(OAUTH_TOKEN));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
  
  const oauthAuth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oauthAuth.setCredentials(token);
  const oauthDrive = google.drive({ version: 'v3', auth: oauthAuth });

  // Detectar alcance del token: drive.file solo ve archivos creados por la app
  const scopeStr = (token.scope || '').toString();
  const scopes = scopeStr.split(/\s+/).filter(Boolean);
  const hasFullDriveScope = scopes.some(s => s.endsWith('/drive') || s.endsWith('/drive.readonly'));

  driveUpload = oauthDrive;
  if (hasFullDriveScope) {
    driveRead = oauthDrive;
    console.log('✅ Usando OAuth (cuenta personal) con alcance completo');
  } else if (hasServiceAccount) {
    console.warn('⚠️ OAuth tiene alcance drive.file (solo archivos propios). Se usará Service Account para lectura/listados.');
    const saAuth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_FILE,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    driveRead = google.drive({ version: 'v3', auth: saAuth });
    console.log('✅ Service Account se usará solo para leer/listar');
  } else {
    console.warn('⚠️ OAuth tiene alcance drive.file y no hay Service Account disponible. Solo se verán archivos creados desde la app.');
    driveRead = oauthDrive;
  }
} else if (hasServiceAccount) {
  // Solo Service Account (lectura/escritura según permisos de carpeta)
  const saAuth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  driveUpload = google.drive({ version: 'v3', auth: saAuth });
  driveRead = driveUpload;
  console.log('⚠️  Usando Service Account (solo lectura/permiso compartido)');
} else {
  console.error('❌ No hay credenciales OAuth ni Service Account disponibles.');
}

const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';

// Leer imágenes cover locales (solo .png directamente en /cover, sin subcarpetas)
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname, 'cover'))
    .filter(f => {
      const fullPath = path.join(__dirname, 'cover', f);
      return fs.statSync(fullPath).isFile() && f.endsWith('.png');
    })
    .map(f => `/cover/${f}`);
  console.log(`✅ ${coverImages.length} imágenes de portada disponibles para fallback`);
} catch (err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// Función para obtener imagen aleatoria de fallback
function getRandomCoverImage() {
  if (coverImages.length === 0) return null;
  return coverImages[Math.floor(Math.random() * coverImages.length)];
}

// Parse drive file name formatted as "Title - Author (Saga #Number).ext"
function parseDriveFileName(fileName) {
  const base = fileName.replace(/\.[^/.]+$/, '');
  const parsed = { title: base, author: 'Desconocido', sagaName: '', sagaNumber: 0 };
  const fullMatch = base.match(/^(.+?)\s*-\s*(.+?)\s*\((.+?)\s*#(\d+)\)$/);
  if (fullMatch) {
    parsed.title = fullMatch[1].trim();
    parsed.author = fullMatch[2].trim();
    parsed.sagaName = fullMatch[3].trim();
    parsed.sagaNumber = parseInt(fullMatch[4]) || 0;
    return parsed;
  }
  const simpleMatch = base.match(/^(.+?)\s*-\s*(.+)$/);
  if (simpleMatch) {
    parsed.title = simpleMatch[1].trim();
    parsed.author = simpleMatch[2].trim();
  }
  return parsed;
}

// Merge Google Books data into a book object without overwriting existing values
function mergeGoogleDataIntoBook(book, data) {
  if (!data) return false;
  let updated = false;
  const imageUrl = data.imageLinks?.thumbnail || data.imageLinks?.smallThumbnail || null;
  if (!book.coverUrl && imageUrl) { book.coverUrl = imageUrl; updated = true; }
  if (!book.imageLinks && data.imageLinks) { book.imageLinks = data.imageLinks; updated = true; }
  if (!book.description && data.description) { book.description = data.description; updated = true; }
  if (!book.publisher && data.publisher) { book.publisher = data.publisher; updated = true; }
  if (!book.publishedDate && data.publishedDate) { book.publishedDate = data.publishedDate; updated = true; }
  if (!book.pageCount && data.pageCount) { book.pageCount = data.pageCount; updated = true; }
  if ((!book.categories || book.categories.length === 0) && data.categories) { book.categories = data.categories; updated = true; }
  if (!book.language && data.language) { book.language = data.language; updated = true; }
  if (book.averageRating == null && data.averageRating != null) { book.averageRating = data.averageRating; updated = true; }
  if (!book.ratingsCount && data.ratingsCount) { book.ratingsCount = data.ratingsCount; updated = true; }
  if (!book.previewLink && data.previewLink) { book.previewLink = data.previewLink; updated = true; }
  return updated;
}

// Convertir Buffer en stream legible (para Google Drive API)
function bufferToStream(buffer) {
  return Readable.from(buffer);
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

// Contador simple de descargas (memoria)
let downloadCount = 0;

// Cache sencillo para ratings externos
const ratingsCache = new Map();
const RATINGS_CACHE_FILE = path.join(os.tmpdir(), 'ratings-cache-bibliokobo.json');
try {
  if (fs.existsSync(RATINGS_CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(RATINGS_CACHE_FILE, 'utf8'));
    Object.entries(data || {}).forEach(([k, v]) => ratingsCache.set(k, Number(v) || 0));
  }
} catch (err) {
  console.warn('No se pudo leer ratings-cache.json, se cargará vacío');
}
let ratingsCacheDirty = false;
let ratingsCacheTimer = null;
function persistRatingsCacheSoon() {
  ratingsCacheDirty = true;
  if (ratingsCacheTimer) return;
  ratingsCacheTimer = setTimeout(() => {
    try {
      const obj = {};
      ratingsCache.forEach((v, k) => { obj[k] = v; });
      fs.writeFileSync(RATINGS_CACHE_FILE, JSON.stringify(obj, null, 2));
      ratingsCacheDirty = false;
    } catch (err) {
      console.warn('No se pudo persistir ratings-cache.json', err.message);
    } finally {
      ratingsCacheTimer = null;
    }
  }, 500);
}

// ------------------ DETECCIÓN KOBO ------------------
function isKobo(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  return ua.includes('kobo') || req.query.kobo === '1';
}

// ------------------ AUTH MIDDLEWARE ------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASS || '252914';
const deniedMessages = [
  "La clave que murmuras no rompe mis cadenas… Inténtalo otra vez, forastero.",
  "Ese no es el conjuro… aquí dentro lo sabríamos. Prueba de nuevo.",
  "Tus palabras golpean la puerta, pero ninguna abre los barrotes. Contraseña incorrecta…",
  "He escuchado miles de claves en esta celda… la tuya no es la correcta.",
  "Si esa es tu mejor contraseña, estaremos encerrados mucho tiempo…",
  "No… no… esa no es… la correcta sigue escapando, como mi cordura…",
  "La contraseña… la contraseña verdadera grita en la oscuridad, pero esa no es.",
  "¿Otra clave falsa? Me recuerda a las promesas que me trajeron aquí…",
  "Intentas escapar, ¿verdad? Esa palabra no abriría ni una celda oxidada.",
  "¿Contraseña? Sí. ¿Correcta? No. Aquí hasta los dementores se reirían…",
  "Ni los dementores aceptarían esa clave… vuelve a intentarlo.",
  "Podrías engañar a un trol, pero no a esta puerta.",
  "La puerta permanece sellada… tu palabra carece de poder.",
  "Has pronunciado la clave equivocada. Los muros susurran tu error.",
  "El encantamiento no responde… quizá intentes otra vez, forastero.",
  "La contraseña es falsa. Los espíritus de Azkaban ríen en la oscuridad.",
  "¡No, no, no! Esa no es la clave… la clave verdadera duele recordarla…",
  "Te equivocas… como todos… siempre se equivocan. Vuelve a intentarlo.",
  "La contraseña… no… esa no… ¡los dementores vendrán si sigues fallando!",
  "Otra vez mal… yo también olvidé la mía una vez… y perdí años en la neblina…",
  "Alto ahí. La contraseña no coincide. Retrocede, visitante.",
  "Acceso denegado. Ni siquiera los condenados usan palabras tan torpes.",
  "Contraseña errónea. Las puertas de esta prisión no ceden tan fácil."
];

function checkAuth(req, res, next) {
  const pass = req.query.pass || req.body.pass || '';
  if (pass === ADMIN_PASSWORD) {
    next();
  } else {
    const randomMsg = deniedMessages[Math.floor(Math.random() * deniedMessages.length)];
    res.status(403).send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Acceso Denegado</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1>Azkaban</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/autores">Autores</a>
      <a href="/sagas">Sagas</a>
    </div>
  </div>
  <div style="padding:60px 40px; color:#eee; text-align:center;">
    <h2 style="font-family:'MedievalSharp', cursive; font-size:28px; color:#19E6D6; margin-bottom:20px;">🔒 Acceso Denegado</h2>
    <p style="font-size:1.2em; line-height:1.8; max-width:700px; margin:0 auto; color:#fff;">${randomMsg}</p>
    <p style="margin-top:30px;">
      <a href="/" class="button">← Volver</a>
    </p>
  </div>
</body>
</html>`);
  }
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
input[type="search"] { padding:6px 8px; margin:0 4px; font-size:12px; border-radius:6px; border:2px solid #19E6D6; background:#111; color:#fff; font-family:'MedievalSharp', cursive; font-weight:normal; transition:0.2s; }
input[type="search"]:focus { outline:none; border-color:#19E6D6; box-shadow:0 0 8px rgba(25,230,214,0.4); }
select { padding:6px 8px; margin:0 4px; font-size:12px; border-radius:6px; border:2px solid #fff; background:#111; color:#fff; font-family:'MedievalSharp', cursive; font-weight:normal; transition:0.2s; }
select:focus { outline:none; border-color:#fff; box-shadow:0 0 8px rgba(255,255,255,0.4); }
button[type="submit"] { padding:6px 12px; font-family:'MedievalSharp', cursive; font-weight:normal; font-size:12px; border:2px solid #19E6D6; background:#111; color:#fff; border-radius:6px; cursor:pointer; transition:0.2s; }
button[type="submit"]:hover { background:#19E6D6; color:#000; }

#grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 130px)); gap:30px; padding:30px 20px 40px 20px; max-width:100%; margin:0 auto; justify-content:center; }
.book { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; width:130px; min-height:auto; background:linear-gradient(180deg, rgba(18,18,18,0.92), rgba(12,12,12,0.9)); padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,0.04); text-align:center; word-wrap:break-word; transition:opacity 0.3s, transform 0.15s; box-shadow:0 6px 18px rgba(0,0,0,0.6); }
.book img { width:90px; height:140px; border-radius:6px; object-fit:cover; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto; }
.title { font-size:12px; font-weight:700; color:#fff; font-family:'MedievalSharp', cursive; margin:0 0 6px 0; padding:6px 4px 6px 4px; border-bottom:1px solid rgba(255,255,255,0.04); line-height:1.3; }
.title a { color: inherit; text-decoration: none; display:block; padding:0; }
.author-span, .number-span { font-size:11px; color:#ddd; font-family:'MedievalSharp', cursive; font-weight:400; display:block; margin-top:4px; padding:0 2px; line-height:1.2; }
.author-span a { color:#fff; text-decoration:none; font-style:italic; font-weight:400; }
.number-span a { color:#19E6D6; text-decoration:none; font-weight:600; font-size:10px; text-transform:uppercase; }
.meta a { font-size:10px; font-weight:bold; text-decoration:none; color:#fff; background:rgba(34,34,34,0.7); padding:3px 6px; border-radius:4px; display:inline-block; margin-top:4px; transition:0.2s; }
.meta a:hover { background:rgba(68,68,68,0.9); }
.author-span a:hover, .number-span a:hover { color:#fff; text-decoration:none; opacity:0.9; }
a.button { display:inline-block; margin:10px; text-decoration:none; padding:14px 28px; background:#222; color:#fff; border-radius:8px; font-size:20px; font-weight:bold; transition:0.2s; }
a.button:hover { background:#444; }

/* Avatares para autores y emblemas para sagas */
.card-block { display:flex; flex-direction:column; align-items:center; gap:8px; }
.avatar-rect { width:90px; height:120px; border-radius:8px; background:linear-gradient(160deg, rgba(40,40,40,0.9), rgba(18,18,18,0.9)); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-family:'MedievalSharp', cursive; font-size:32px; color:#fff; letter-spacing:1px; text-shadow:0 2px 6px rgba(0,0,0,0.6); }
.count-badge { margin-top:-4px; font-size:11px; color:#19E6D6; background:rgba(25,230,214,0.12); border:1px solid rgba(25,230,214,0.5); padding:3px 8px; border-radius:999px; font-family:Garamond, serif; }
.emblem-rect { width:90px; height:120px; border-radius:8px; background:linear-gradient(180deg, rgba(18,18,18,0.95), rgba(8,8,8,0.9)); border:1px solid rgba(25,230,214,0.35); position:relative; display:flex; align-items:center; justify-content:center; }
.emblem-rect svg { width:48px; height:48px; fill:none; stroke:#19E6D6; stroke-width:2; filter:drop-shadow(0 0 4px rgba(25,230,214,0.5)); }
.book:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(0,0,0,0.35); }

/* Checkbox de selección en esquina */
.book-checkbox { appearance:none; -webkit-appearance:none; position:absolute; top:4px; right:2px; width:14px; height:14px; border:1.5px solid rgba(255,255,255,0.4); border-radius:50%; background:rgba(0,0,0,0.8); cursor:pointer; display:grid; place-items:center; transition:0.15s ease; z-index:10; }
.book-checkbox:hover { border-color:rgba(255,255,255,0.6); }
.book-checkbox:focus { outline:none; box-shadow:0 0 6px rgba(25,230,214,0.5); }
.book-checkbox::after { content:""; width:8px; height:8px; border-radius:1px; clip-path:polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0, 43% 62%); background:transparent; transform:scale(0); transition:0.15s ease; }
.book-checkbox:checked { border-color:#19E6D6; background:rgba(25,230,214,0.3); box-shadow:0 0 0 1px rgba(25,230,214,0.4), 0 0 8px rgba(25,230,214,0.4); }
.book-checkbox:checked::after { background:#19E6D6; transform:scale(1); filter:drop-shadow(0 0 3px rgba(25,230,214,0.6)); }

/* Modal login para stats */
#login-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; justify-content:center; align-items:center; }
#login-modal.active { display:flex; }
.login-box { background:linear-gradient(135deg, rgba(18,18,18,0.95), rgba(12,12,12,0.9)); border:2px solid rgba(25,230,214,0.5); border-radius:12px; padding:40px; text-align:center; max-width:400px; box-shadow:0 8px 32px rgba(0,0,0,0.8); }
.login-box h2 { font-family:'MedievalSharp', cursive; color:#19E6D6; font-size:24px; margin:0 0 20px 0; }
.login-box input { width:100%; padding:12px; margin:10px 0; border:1px solid rgba(25,230,214,0.4); background:rgba(25,25,25,0.8); color:#fff; border-radius:6px; font-size:14px; box-sizing:border-box; }
.login-box input:focus { outline:none; border-color:#19E6D6; box-shadow:0 0 8px rgba(25,230,214,0.4); }
.login-box button { padding:10px 20px; margin:10px 5px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:#19E6D6; color:#000; font-size:14px; }
.login-box button:hover { background:#1dd4c8; }
.login-box button.cancel { background:rgba(255,255,255,0.1); color:#fff; }
.login-box button.cancel:hover { background:rgba(255,255,255,0.2); }
.hidden-stats-btn { position:fixed; bottom:20px; right:20px; width:44px; height:44px; background:transparent; border:1px solid #19E6D6; border-radius:50%; color:#19E6D6; cursor:pointer; z-index:100; transition:0.25s; display:flex; align-items:center; justify-content:center; padding:0; }
.hidden-stats-btn svg { width:22px; height:22px; fill:none; stroke:#19E6D6; stroke-width:2.2; filter:drop-shadow(0 0 4px rgba(25,230,214,0.4)); }
.hidden-stats-btn:hover { box-shadow:0 0 10px rgba(25,230,214,0.4), 0 0 20px rgba(25,230,214,0.2); transform:scale(1.08); }

/* ensure content sits below fixed top banner */
body { padding-top:300px; }

/* Desktop: aumentar 20% altura de header-banner.top */
@media (min-width: 1024px) {
  .header-banner.top { height:360px; }
  .overlay.top { height:360px; }
  body { padding-top:360px; }
}

/* Tablet: mantener tamaño normal */
@media (min-width: 768px) and (max-width: 1023px) {
  .header-banner.top { height:300px; }
  .overlay.top { height:300px; }
  body { padding-top:300px; }
}

/* Mobile: mantener tamaño normal */
@media (max-width: 767px) {
  .header-banner.top { height:300px; }
  .overlay.top { height:300px; }
  body { padding-top:300px; }
}
`;

// ------------------ FUNCIONES ------------------
async function listAllFiles(folderId) {
  if (!driveRead) throw new Error('Google Drive no está inicializado para lectura');
  let files = [], pageToken = null;
  do {
    const res = await driveRead.files.list({
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

// Recargar bookMetadata desde el JSON más reciente en disco
function reloadBooksMetadata() {
  try {
    if (fs.existsSync(BOOKS_FILE)) {
      bookMetadata = JSON.parse(fs.readFileSync(BOOKS_FILE));
    }
  } catch (err) {
    console.warn('Error releyendo books.json:', err.message);
  }
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

function sagaEmblemSvg(name) {
  const icons = [
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4 L40 18 L24 44 L8 18 Z" /><path d="M24 12 L32 20 L24 36 L16 20 Z" /></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 L40 14 V26 c0 8-7 14-16 18-9-4-16-10-16-18V14 Z" /><path d="M16 18 L24 22 L32 18" /></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 12 L22 10 V38 L8 40 Z" /><path d="M40 12 L26 10 V38 L40 40 Z" /><path d="M22 24 L26 24" /></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" /><path d="M24 8 V16" /><path d="M24 32 V40" /><path d="M16 24 H8" /><path d="M40 24 H32" /></svg>'
  ];
  const sum = (name || '').split('').reduce((acc,c)=>acc + c.charCodeAt(0), 0);
  return icons[sum % icons.length];
}

function azkbanSymbol(text) {
  const symbols = [
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5m0 4v1"/></svg>', // Prisión
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M4 7h16M4 7v10c0 2 2 4 8 4s8-2 8-4V7M8 11v6M12 11v6M16 11v6"/></svg>', // Rejas
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 4v6m0 4v1"/></svg>', // Oscuridad
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>', // Estrella malvada
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M3 12c0-3.314 2.686-6 6-6h6c3.314 0 6 2.686 6 6s-2.686 6-6 6H9c-3.314 0-6-2.686-6-6z"/><path d="M8 12h8"/></svg>', // Cápsula
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M6 12h12M12 6v12M4 10h2M18 10h2M4 14h2M18 14h2"/></svg>', // Cruz
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M8 12l4-4 4 4M8 12l4 4 4-4"/></svg>' // Espiral
  ];
  const sum = (text || '').split('').reduce((acc,c)=>acc + c.charCodeAt(0), 0);
  return symbols[sum % symbols.length];
}

// Mensajes aleatorios cuando no hay resultados en búsquedas
const noResultMessages = [
  '<strong>Un prisionero de Azkaban murmura:</strong> "El libro no existe o fue confiscado. Vuelve luego."',
  '<strong>Un prisionero de Azkaban murmura:</strong> "Claramente, lo que buscas ha sido confiscado por el Ministerio por \"contenido altamente peligroso\"... O tal vez, simplemente no existe. Vuelve cuando tu búsqueda sea menos patética."',
  '¡Ah, qué tragedia! Un prisionero de Azkaban se carcajea entre dientes:<br>“Lo que buscas no aparece ni en los registros secretos del Ministerio… eso solo significa dos cosas: fue incinerado… o jamás existió.”',
  '“¡Menudo espectáculo! Desde una celda en ruinas, un reo susurra:<br>‘He revisado hasta las sombras… y no, no hay rastro de ese nombre. Quizá tu imaginación te juega trucos patéticos.’”',
  '“¡Qué fracaso tan glorioso! Un prisionero encadenado murmura:<br>‘Ni los dementores lograron encontrar eso… y créeme, ellos olfatean hasta los pensamientos. Definitivamente, no existe.’”',
  '“¡Ay, qué pena! Una voz ronca se oye entre los muros:<br>‘Si el Ministerio lo confiscó, ni yo podría encontrarlo… pero lo más probable es que solo estés buscando fantasmas.’”',
  '“¡Oh, la desilusión! Un interno se ríe con un eco perturbador:<br>‘Tu búsqueda está tan vacía como mi celda… ese autor no figura en ninguna parte. Acepta la derrota, forastero.’”',
  '“¡Qué vergüenza tan innecesaria! Un prisionero susurra enloquecido:<br>‘Ni siquiera los archivos prohibidos tienen ese título… y créeme, lo revisé todo. Eso nunca ha existido.’”',
  '“¡Un desastre anunciado! Desde la oscuridad, alguien rechina los dientes:<br>‘Otro nombre inexistente… el Ministerio ni se molestaría en confiscar algo tan insignificante.’”',
  '“¡Qué intento tan triste! Una voz gastada murmura:<br>‘Si estuviera en algún registro, lo habría oído durante mis años de encierro… pero no, tu búsqueda es pura fantasía.’”',
  '“¡Oh, qué lástima infinita! Un prisionero observa la nada y dice:<br>‘Lo que buscas no está, no estuvo y probablemente nunca estará. Incluso la magia tiene límites.’”',
  '“¡Qué patética sorpresa! Desde una celda húmeda se escucha:<br>‘Ni el Ministerio, ni Azkaban, ni los dementores conocen lo que pides… así que debes aceptar la verdad: no existe.’”'
];

function getRandomNoResultHtml() {
  const msg = noResultMessages[Math.floor(Math.random() * noResultMessages.length)];
  return `<div style="padding:40px;color:#eee;"><h2>¡Oh, qué desastre!</h2><p style="font-size: 1.2em; line-height: 1.5;">${msg}</p></div>`;
}

// Runas: paleta de símbolos estilizados (líneas simples)
function runePalette() {
  return [
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 3v18"/><path d="M12 12l6-6"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 3v18"/><path d="M12 12l-6-6"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 3v18"/><path d="M12 12l6-4"/><path d="M12 12l6 4"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 3v18"/><path d="M12 10l-6 4"/><path d="M12 14l-6-4"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4v16"/><path d="M6 8l6 8"/><path d="M18 8l-6 8"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M8 4l8 16"/><path d="M16 4l-8 16"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4l5 8-5 8-5-8z"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4v16"/><path d="M8 8l4 4 4-4"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 20V4"/><path d="M16 16l-4-4-4 4"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M7 5l10 14"/><path d="M17 5L7 19"/><path d="M7 12h10"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4v16"/><path d="M6 9l6 6"/><path d="M18 9l-6 6"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4v16"/><path d="M7 8h10"/><path d="M7 16h10"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M8 4h8"/><path d="M8 12h8"/><path d="M8 20h8"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M6 5h12"/><path d="M12 5v14"/><path d="M8 19h8"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4v16"/><path d="M8 12l4-8 4 8-4 8z"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M7 7l10 10"/><path d="M17 7L7 17"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M6 12h12"/><path d="M12 4v16"/><path d="M8 8l8 8"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 5v14"/><path d="M7 9l5 5 5-5"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M8 4l8 16"/><path d="M16 4L8 20"/><path d="M12 10v4"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4l6 8-6 8-6-8z"/><path d="M12 8v8"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/><path d="M12 3v18"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M12 4v16"/><path d="M7 7l10 10"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M7 5h10"/><path d="M7 19h10"/><path d="M12 5v14"/><path d="M7 12h10"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/><path d="M12 6v12"/></svg>',
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2" stroke-linecap="round"><path d="M9 4h6"/><path d="M12 4v16"/><path d="M8 14l4-6 4 6"/></svg>'
  ];
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Devuelve una lista de runas sin repetir; si faltan, rota variantes
function uniqueRunes(count) {
  const palette = runePalette();
  const pool = shuffleArray([...palette]);
  const result = [];
  let variant = 0;
  while (result.length < count) {
    if (pool.length) {
      result.push(pool.pop());
      continue;
    }
    const base = palette[variant % palette.length];
    const angle = ((variant * 37) % 80) - 40; // giro ligero para diferenciarlas
    const rotated = base.replace('<svg ', `<svg style="transform:rotate(${angle}deg)" `);
    result.push(rotated);
    variant++;
  }
  return result;
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

// Ratings vía Google Books API
async function fetchRating(title, author, isbn = null) {
  const key = `${(title||'').toLowerCase()}|${(author||'').toLowerCase()}|${isbn||''}`;
  if (ratingsCache.has(key)) return ratingsCache.get(key);

  try {
    const query = isbn || `intitle:${title} inauthor:${author}`;
    const keyParam = GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : '';
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&printType=books${keyParam}`;
    
    const resp = await axios.get(url, { timeout: 4000 });
    const item = resp.data?.items?.[0];
    
    if (item?.volumeInfo?.averageRating) {
      const rating = item.volumeInfo.averageRating;
      if (rating > 0 && rating <= 5) {
        setRatingCache(key, rating);
        return rating;
      }
    }
  } catch (err) {
    console.warn(`[fetchRating] Error: ${err?.message}`);
  }

  setRatingCache(key, 0);
  return 0;
}

// Control de rate limiting para Google Books API
let lastGoogleBooksCall = 0;
const GOOGLE_BOOKS_MIN_DELAY = 800; // 800ms entre llamadas

// Obtener datos completos del libro desde Google Books
async function fetchGoogleBooksData(title, author, isbn = null) {
  let retries = 0;
  const maxRetries = 2;
  
  while (retries <= maxRetries) {
    try {
      // Esperar para respetar rate limiting
      const timeSinceLastCall = Date.now() - lastGoogleBooksCall;
      if (timeSinceLastCall < GOOGLE_BOOKS_MIN_DELAY) {
        const waitTime = GOOGLE_BOOKS_MIN_DELAY - timeSinceLastCall;
        await new Promise(r => setTimeout(r, waitTime));
      }
      
      lastGoogleBooksCall = Date.now();
      
      // Construir query mejorada: buscar primero con ISBN, luego con título+autor
      let query;
      if (isbn) {
        query = `isbn:${isbn}`;
      } else {
        // Escapar caracteres especiales y usar búsqueda por título e autor
        const cleanTitle = title.replace(/[:"()]/g, '');
        const cleanAuthor = author.replace(/[:"()]/g, '');
        query = `intitle:"${cleanTitle}" inauthor:"${cleanAuthor}"`;
      }
      const keyParam = GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : '';
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&printType=books${keyParam}`;
      
      const resp = await axios.get(url, { timeout: 5000 });
      const item = resp.data?.items?.[0];
      
      if (item?.volumeInfo) {
        const vol = item.volumeInfo;
        return {
          title: vol.title || null,
          authors: vol.authors || [],
          publisher: vol.publisher || null,
          publishedDate: vol.publishedDate || null,
          description: vol.description || null,
          pageCount: vol.pageCount || null,
          categories: vol.categories || [],
          averageRating: vol.averageRating || null,
          ratingsCount: vol.ratingsCount || null,
          language: vol.language || null,
          imageLinks: vol.imageLinks || null,
          previewLink: vol.previewLink || null
        };
      }
      return null;
    } catch (err) {
      retries++;
      if (err?.response?.status === 429) {
        // Rate limit: esperar más tiempo antes de reintentar
        if (retries <= maxRetries) {
          const backoffDelay = Math.pow(2, retries) * 2000; // 4s, 8s
          console.warn(`[fetchGoogleBooksData] 429 - Reintentando en ${backoffDelay}ms (intento ${retries}/${maxRetries})`);
          await new Promise(r => setTimeout(r, backoffDelay));
          lastGoogleBooksCall = 0; // Reset para poder hacer nueva llamada
          continue;
        }
      }
      console.warn(`[fetchGoogleBooksData] Error: ${err?.message}`);
      return null;
    }
  }
  
  return null;
}

async function fetchRatingOpenLibrary(title, author) {
  try {
    const sUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title||'')}&author=${encodeURIComponent(author||'')}&limit=3`;
    const sr = await axios.get(sUrl, { timeout: 5000 });
    const docs = sr.data.docs || [];
    if (!docs.length || !docs[0].key) return 0;
    const workKey = docs[0].key.startsWith('/works/') ? docs[0].key : `/works/${docs[0].key}`;
    const rUrl = `https://openlibrary.org${workKey}/ratings.json`;
    const rr = await axios.get(rUrl, { timeout: 5000 });
    const avg = rr.data?.summary?.average || rr.data?.average || 0;
    return Number(avg) || 0;
  } catch (err) {
    return 0;
  }
}

function setRatingCache(key, value) {
  ratingsCache.set(key, value);
  persistRatingsCacheSoon();
}

function hasRatingCache(title, author, isbn = null) {
  const key = `${(title||'').toLowerCase()}|${(author||'').toLowerCase()}|${isbn||''}`;
  return ratingsCache.has(key);
}

async function fetchGoodreadsPageRating(pageId) {
  if (!pageId) return 0;
  try {
    const pageUrl = `https://www.goodreads.com/book/show/${pageId}`;
    console.log(`[Page Rating] Fetching ${pageUrl}`);
    const html = await axios.get(pageUrl, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.data || '');
    
    // Strategy 1: Look for data-rating attributes
    let match = /data-rating="([0-9.]+)"/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) {
        console.log(`[Page Rating] Found data-rating: ${num}`);
        return num;
      }
    }
    
    // Strategy 2: Look in JSON-LD structured data
    const jsonLdMatch = /(<script[^>]+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>)/gi;
    let m;
    while ((m = jsonLdMatch.exec(html)) !== null) {
      try {
        const jsonStr = m[1].replace(/<[^>]+>/g, '');
        const json = JSON.parse(jsonStr);
        if (json.aggregateRating?.ratingValue) {
          const num = parseFloat(json.aggregateRating.ratingValue);
          if (num && num > 0 && num <= 5) {
            console.log(`[Page Rating] Found in JSON-LD: ${num}`);
            return num;
          }
        }
      } catch (e) {}
    }
    
    // Strategy 3: itemprop="ratingValue"
    match = /itemprop="ratingValue"[^>]*>\s*([0-9.,]+)/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num && num > 0 && num <= 5) {
        console.log(`[Page Rating] Found itemprop ratingValue: ${num}`);
        return num;
      }
    }
    
    // Strategy 4: "average_rating":"4.00" pattern
    match = /"average_rating"\s*:\s*"([0-9.]+)"/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) {
        console.log(`[Page Rating] Found average_rating: ${num}`);
        return num;
      }
    }
    
    // Strategy 5: "avgRating":4.00 pattern
    match = /"avgRating"\s*:\s*([0-9.]+)/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) {
        console.log(`[Page Rating] Found avgRating: ${num}`);
        return num;
      }
    }
    
    // Strategy 6: rating in JSON object
    match = /"rating"\s*:\s*"?([0-9.]+)"?/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) {
        console.log(`[Page Rating] Found rating field: ${num}`);
        return num;
      }
    }
    
    console.log(`[Page Rating] No rating found in page ${pageId}`);
  } catch (err) {
    console.warn(`[Page Rating] Error for ${pageId}: ${err.message}`);
  }
  return 0;
}

async function fetchGoodreadsSearchRating(title, author) {
  // DEPRECATED - Now using autocomplete API in fetchRating
  return 0;
}

async function fetchGoodreadsByIsbn(isbn) {
  // DEPRECATED - Now using autocomplete API in fetchRating
  return 0;
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
  const orden = (req && (req.query.ordenar || req.query.orden)) || 'alfabetico';
  libros = ordenarBooks(libros, orden, tipo);
  
  // Paginación
  const itemsPerPage = 25;
  const currentPage = parseInt(req?.query?.page || '1', 10);
  const totalItems = libros.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLibros = libros.slice(startIndex, endIndex);
  
  let booksHtml = paginatedLibros.map(book => {
    const cover = book.coverUrl || getCoverForBook(book.id);
    const imgHtml = cover ? `<img src="${cover}" data-book-id="${book.id}" data-title="${book.title}" data-author="${book.author}" />` : `<div style="width:80px;height:120px;background:#333;border-radius:5px;" data-book-id="${book.id}" data-title="${book.title}" data-author="${book.author}"></div>`;
    // SIEMPRE usar solo datos del JSON
    const title = book.title || 'Sin título';
    const author = book.author || 'Desconocido';
    const sagaName = book.saga?.name || '';
    const sagaNum = book.saga?.number || '';
    // Si estamos en página de saga, mostrar número; si no, no mostrar
    const sagaDisplay = (tipo === 'saga' && sagaNum) ? `${sagaName} #${sagaNum}` : sagaName;
    const sagaHtml = sagaName ? `<div class="number-span"><a href="/saga?name=${encodeURIComponent(sagaName)}">${sagaDisplay}</a></div>` : '';
    const authorHtml = `<div class="author-span"><a href="/autor?name=${encodeURIComponent(author)}">${author}</a></div>`;
    // link image and title to detail page
    const imgLink = `<a href="/libro?id=${encodeURIComponent(book.id)}">${imgHtml}</a>`;
    const titleLink = `<a href="/libro?id=${encodeURIComponent(book.id)}">${title}</a>`;
    const checkbox = `<input type="checkbox" class="book-checkbox" value="${book.id}" title="Seleccionar para descargar en ZIP">`;
    return `<div class="book">${checkbox}${imgLink}<div class="title">${titleLink}</div>${authorHtml}${sagaHtml}<div class="meta"><a href="/download?id=${encodeURIComponent(book.id)}">Descargar</a></div></div>`;
  }).join('');

  if (!booksHtml || booksHtml.trim() === '') {
    booksHtml = noResultsHtml || getRandomNoResultHtml();
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
    <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
      <select id="orden" name="ordenar" onchange="this.form.submit()" style="width:auto;min-width:0;padding:4px 8px;border-radius:6px;">
        <option value="alfabetico" ${orden==='alfabetico'?'selected':''}>A→Z</option>
        <option value="alfabetico-desc" ${orden==='alfabetico-desc'?'selected':''}>Z→A</option>
        <option value="recientes" ${orden==='recientes'?'selected':''}>Más recientes</option>
        ${tipo==='saga'?`<option value="numero" ${orden==='numero'?'selected':''}>#Número</option>`:''}
      </select>
      <button type="button" id="multi-download-btn" style="display:none;padding:6px 12px;border-radius:8px;border:1px solid #19E6D6;background:#19E6D6;color:#000;font-family:'MedievalSharp', cursive;font-size:14px;cursor:pointer;text-shadow:0 1px 2px rgba(255,255,255,0.8);box-shadow:0 4px 12px rgba(0,0,0,0.4);">Descarga múltiple</button>
    </div>
    <input type="hidden" name="name" value="${nombre}" />
    <input type="hidden" name="page" value="${currentPage}" />
  </form>
  <div id="grid">${booksHtml}</div>
  
  ${totalPages > 1 ? `
  <div style="text-align:center;margin:30px 0;display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;">
    ${currentPage > 1 ? `<a href="?${new URLSearchParams({...req.query, page: currentPage - 1}).toString()}" class="button">← Anterior</a>` : ''}
    <span style="color:#19E6D6;font-family:'MedievalSharp',cursive;font-size:16px;">Página ${currentPage} de ${totalPages}</span>
    ${currentPage < totalPages ? `<a href="?${new URLSearchParams({...req.query, page: currentPage + 1}).toString()}" class="button">Siguiente →</a>` : ''}
  </div>
  ` : ''}
  
  <p><a href="/${tipo==='autor'?'autores':'sagas'}" class="button">← Volver</a></p>

  <script>
    // Multi-download button appears when more than one checkbox is selected
    const checkboxes = document.querySelectorAll('.book-checkbox');
    const multiBtn = document.getElementById('multi-download-btn');
    
    function updateMultiBtn() {
      if (!multiBtn) return;
      const selected = Array.from(checkboxes).filter(cb => cb.checked);
      if (selected.length > 1) {
        multiBtn.style.display = 'inline-block';
        multiBtn.disabled = false;
        multiBtn.textContent = 'Descarga múltiple (' + selected.length + ')';
      } else {
        multiBtn.style.display = 'none';
        multiBtn.disabled = true;
      }
    }
    
    checkboxes.forEach(cb => cb.addEventListener('change', updateMultiBtn));
    
    multiBtn?.addEventListener('click', async () => {
      const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
      if (selected.length < 2) return;
      
      multiBtn.disabled = true;
      const originalLabel = multiBtn.textContent;
      multiBtn.textContent = 'Creando ZIP...';
      
      try {
        const res = await fetch('/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selected })
        });
        
        if (!res.ok) throw new Error('Error en descarga');
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'libros.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Deseleccionar checkboxes después de descargar
        checkboxes.forEach(cb => cb.checked = false);
        updateMultiBtn();
      } catch (err) {
        alert('Error al crear ZIP: ' + err.message);
        multiBtn.textContent = originalLabel;
      }
      
      multiBtn.disabled = false;
    });
    
    updateMultiBtn();
    
    // Cargar covers desde API usando IntersectionObserver
    const coverQueue = [];
    let isLoadingCover = false;
    
    async function loadNextCover() {
      if (isLoadingCover || coverQueue.length === 0) return;
      isLoadingCover = true;
      
      const el = coverQueue.shift();
      const id = el.getAttribute('data-book-id');
      const title = el.getAttribute('data-title');
      const author = el.getAttribute('data-author');
      
      try {
        const url = '/api/book-cover?id=' + id + '&title=' + encodeURIComponent(title) + '&author=' + encodeURIComponent(author);
        const res = await fetch(url);
        const data = await res.json();
        if (data.coverUrl && el.tagName === 'IMG') {
          el.src = data.coverUrl;
        }
      } catch (err) {
        console.error('Error loading cover:', err);
      }
      
      isLoadingCover = false;
      if (coverQueue.length > 0) {
        setTimeout(loadNextCover, 100);
      }
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (!img.src || img.src.includes('portada')) {
            if (!coverQueue.includes(img)) {
              coverQueue.push(img);
              loadNextCover();
            }
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '50px' });
    
    document.querySelectorAll('[data-book-id]').forEach(el => {
      if (el.tagName === 'IMG') observer.observe(el);
    });
    
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
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Azkaban Reads</title><link rel="preload" as="image" href="/cover/portada/portada1.png?v=${Date.now()}"><style>${css}</style><style>body{padding-top:0;} .header-banner.home{background-size:cover;background-position:center;will-change:transform;background-color:#0a0a0a;opacity:0;animation:fadeInBanner 1.2s ease forwards;} .header-banner.home::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 70%, #0a0a0a 100%);pointer-events:none;z-index:1;} .overlay.home{opacity:0;visibility:hidden;animation:fadeIn 0.6s ease forwards;z-index:2;} @keyframes fadeInBanner{from{opacity:0;} to{opacity:1;}} @keyframes fadeIn{from{opacity:0;} to{opacity:1;visibility:visible;}}</style></head>
<body>
  <div class="header-banner home" id="home-bg" style="height:100vh; background-size:cover; background-position:center; background-image:url('/cover/portada/portada1.png?v=${Date.now()}');"></div>
  <div class="overlay home" style="justify-content:center;">
    <h1>Azkaban Reads</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/autores">Autores</a>
      <a href="/sagas">Sagas</a>
    </div>
  </div>
  
  <!-- Botón flotante de stats -->
  <button id="stats-btn" style="position:fixed;bottom:20px;right:80px;width:48px;height:48px;border-radius:50%;background:transparent;border:2px solid #19E6D6;cursor:pointer;z-index:100;display:flex;align-items:center;justify-content:center;transition:0.25s;padding:0;color:#19E6D6;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2l-8 12h7l-7 8 12-14h-7l3-6z"></path>
    </svg>
  </button>
  
  <!-- Botón flotante de upload -->
  <button id="upload-btn" style="position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;background:transparent;border:2px solid #19E6D6;cursor:pointer;z-index:100;display:flex;align-items:center;justify-content:center;transition:0.25s;padding:0;color:#19E6D6;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  </button>
  
  <!-- Modal de login para stats/upload -->
  <div id="login-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;justify-content:center;align-items:center;">
    <div style="background:linear-gradient(135deg, rgba(18,18,18,0.95), rgba(12,12,12,0.9));border:2px solid rgba(25,230,214,0.5);border-radius:12px;padding:40px;text-align:center;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.8);">
      <h2 id="modal-title" style="font-family:'MedievalSharp', cursive;color:#19E6D6;font-size:24px;margin:0 0 20px 0;">Acceso a Stats</h2>
      <input type="password" id="pass-input" placeholder="Contraseña" style="width:100%;padding:12px;margin:10px 0;border:2px solid #19E6D6;background:rgba(25,25,25,0.8);color:#fff;border-radius:6px;font-size:14px;box-sizing:border-box;outline:none;transition:all 0.3s ease;" onkeypress="if(event.key==='Enter')document.getElementById('login-btn').click();">
      <div id="error-message" style="display:none;margin-top:10px;color:#ff6b6b;font-family:'MedievalSharp', cursive;font-size:13px;line-height:1.4;min-height:50px;"></div>
      <div style="margin-top:20px;">
        <button id="login-btn" style="padding:10px 20px;margin:10px 5px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;background:#19E6D6;color:#000;font-size:14px;">Entrar</button>
        <button id="cancel-btn" style="padding:10px 20px;margin:10px 5px;border:none;border-radius:6px;font-weight:bold;cursor:pointer;background:rgba(255,255,255,0.1);color:#fff;font-size:14px;">Cancelar</button>
      </div>
    </div>
  </div>
  
  <script>
    const errorMessages = [
      "La clave que murmuras no rompe mis cadenas… Inténtalo otra vez, forastero.",
      "Ese no es el conjuro… aquí dentro lo sabríamos. Prueba de nuevo.",
      "Tus palabras golpean la puerta, pero ninguna abre los barrotes. Contraseña incorrecta…",
      "He escuchado miles de claves en esta celda… la tuya no es la correcta.",
      "Si esa es tu mejor contraseña, estaremos encerrados mucho tiempo…",
      "No… no… esa no es… la correcta sigue escapando, como mi cordura…",
      "La contraseña… la contraseña verdadera grita en la oscuridad, pero esa no es.",
      "¿Otra clave falsa? Me recuerda a las promesas que me trajeron aquí…",
      "Intentas escapar, ¿verdad? Esa palabra no abriría ni una celda oxidada.",
      "¿Contraseña? Sí. ¿Correcta? No. Aquí hasta los dementores se reirían…",
      "Ni los dementores aceptarían esa clave… vuelve a intentarlo.",
      "Podrías engañar a un trol, pero no a esta puerta.",
      "La puerta permanece sellada… tu palabra carece de poder.",
      "Has pronunciado la clave equivocada. Los muros susurran tu error.",
      "El encantamiento no responde… quizá intentes otra vez, forastero.",
      "La contraseña es falsa. Los espíritus de Azkaban ríen en la oscuridad.",
      "¡No, no, no! Esa no es la clave… la clave verdadera duele recordarla…",
      "Te equivocas… como todos… siempre se equivocan. Vuelve a intentarlo.",
      "La contraseña… no… esa no… ¡los dementores vendrán si sigues fallando!",
      "Otra vez mal… yo también olvidé la mía una vez… y perdí años en la neblina…",
      "Alto ahí. La contraseña no coincide. Retrocede, visitante.",
      "Acceso denegado. Ni siquiera los condenados usan palabras tan torpes.",
      "Contraseña errónea. Las puertas de esta prisión no ceden tan fácil."
    ];
    
    const statsBtn = document.getElementById('stats-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const loginModal = document.getElementById('login-modal');
    const loginBtn = document.getElementById('login-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const passInput = document.getElementById('pass-input');
    const errorMessage = document.getElementById('error-message');
    const modalTitle = document.getElementById('modal-title');
    
    let currentAction = null;
    
    statsBtn.addEventListener('click', () => {
      currentAction = 'stats';
      modalTitle.textContent = 'Acceso a Stats';
      loginModal.style.display = 'flex';
      passInput.focus();
      errorMessage.style.display = 'none';
      passInput.value = '';
    });
    
    uploadBtn.addEventListener('click', () => {
      currentAction = 'upload';
      modalTitle.textContent = 'Acceder a Uploads';
      loginModal.style.display = 'flex';
      passInput.focus();
      errorMessage.style.display = 'none';
      passInput.value = '';
    });
    
    cancelBtn.addEventListener('click', () => {
      loginModal.style.display = 'none';
      passInput.value = '';
      errorMessage.style.display = 'none';
      currentAction = null;
    });
    
    loginBtn.addEventListener('click', () => {
      if (passInput.value === '252914') {
        if (currentAction === 'stats') {
          window.location.href = '/stats?pass=' + encodeURIComponent(passInput.value);
        } else if (currentAction === 'upload') {
          window.location.href = '/upload?pass=' + encodeURIComponent(passInput.value);
        }
      } else {
        const randomMsg = errorMessages[Math.floor(Math.random() * errorMessages.length)];
        errorMessage.textContent = randomMsg;
        errorMessage.style.display = 'block';
        passInput.value = '';
        passInput.focus();
      }
    });
    
    passInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loginBtn.click();
    });
    
    statsBtn.addEventListener('mouseenter', () => {
      statsBtn.style.boxShadow = '0 0 15px rgba(25,230,214,0.5)';
      statsBtn.style.transform = 'scale(1.1)';
    });
    
    statsBtn.addEventListener('mouseleave', () => {
      statsBtn.style.boxShadow = 'none';
      statsBtn.style.transform = 'scale(1)';
    });
    
    uploadBtn.addEventListener('mouseenter', () => {
      uploadBtn.style.boxShadow = '0 0 15px rgba(25,230,214,0.5)';
      uploadBtn.style.transform = 'scale(1.1)';
    });
    
    uploadBtn.addEventListener('mouseleave', () => {
      uploadBtn.style.boxShadow = 'none';
      uploadBtn.style.transform = 'scale(1)';
    });
  </script>
</body>
</html>`);
});

// Libros
app.get('/libros', async (req,res)=>{
  try {
    const query = (req.query.buscar||'').trim().toLowerCase();
    const orden = req.query.ordenar||'alfabetico';
    
    // Recargar bookMetadata desde el JSON más reciente
    reloadBooksMetadata();
    
    // Sincronizar con Drive para asegurar que tenemos todos los libros
    const files = await listAllFiles(folderId);
    actualizarBooksJSON(files);

    // Trabajar SOLO con datos del JSON
    let librosForRender = bookMetadata.filter(book => {
      // Verificar que el libro existe en Drive
      return files.some(f => f.id === book.id);
    });

    // Aplicar búsqueda
    if(query){
      librosForRender = librosForRender.filter(book => {
        const title = (book.title || '').toLowerCase();
        const author = (book.author || '').toLowerCase();
        return title.includes(query) || author.includes(query);
      });
    }

    res.send(renderBookPage({libros:librosForRender,titlePage:'Libros',tipo:'libros',nombre:'libros',req,noResultsHtml:getRandomNoResultHtml()}));
  } catch(err){console.error(err); res.send('<p>Error al cargar libros.</p>');}
});

// Autores
app.get('/autores', (req,res)=>{
  reloadBooksMetadata();
  const query = (req.query.buscar||'').trim().toLowerCase();
  let autores = [...new Set(bookMetadata.map(b=>b.author).filter(a=>a))].sort();
  if(query) autores = autores.filter(a=>a.toLowerCase().includes(query));
  const authorsHtml = autores.length ? autores.map(a=>{
    const initials = a.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0, 3);
    return `<div class="book"><div style="width:50px; height:50px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:8px;"><span style="font-family:'MedievalSharp', cursive; color:#19E6D6; font-size:18px; font-weight:normal;">${initials}</span></div><div class="title">${a}</div><div class="meta"><a href="/autor?name=${encodeURIComponent(a)}">Ver libros</a></div></div>`;
  }).join('') : getRandomNoResultHtml();
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
  reloadBooksMetadata();
  const query = (req.query.buscar||'').trim().toLowerCase();
  let sagas = [...new Set(bookMetadata.map(b=>b.saga?.name).filter(a=>a))].sort();
  if(query) sagas = sagas.filter(s=>s.toLowerCase().includes(query));
  const runes = uniqueRunes(sagas.length);
  const sagasHtml = sagas.length ? sagas.map((s, idx)=>{
    const symbol = runes[idx];
    return `<div class="book"><div style="width:50px; height:50px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:8px;">${symbol}</div><div class="title">${s}</div><div class="meta"><a href="/saga?name=${encodeURIComponent(s)}">Ver libros</a></div></div>`;
  }).join('') : getRandomNoResultHtml();
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
  const query = (req.query.buscar||'').trim().toLowerCase();
  const orden = req.query.ordenar || 'alfabetico';
  let libros = bookMetadata.filter(b=>b.author===nombreAutor);
  if (query) {
    libros = libros.filter(b=>{
      const title = (b.title||'').toLowerCase();
      const author = (b.author||'').toLowerCase();
      return title.includes(query) || author.includes(query);
    });
  }
  libros = ordenarBooks(libros, orden, 'autor');
  res.send(renderBookPage({libros,titlePage:`Libros de ${nombreAutor}`,tipo:'autor',nombre:nombreAutor,req}));
});

// Saga individual
app.get('/saga', (req,res)=>{
  const nombreSaga = req.query.name;
  if(!nombreSaga) return res.redirect('/sagas');
  const query = (req.query.buscar||'').trim().toLowerCase();
  const orden = req.query.ordenar || 'alfabetico';
  let libros = bookMetadata.filter(b=>b.saga?.name===nombreSaga);
  if (query) {
    libros = libros.filter(b=>{
      const title = (b.title||'').toLowerCase();
      const author = (b.author||'').toLowerCase();
      return title.includes(query) || author.includes(query);
    });
  }
  libros = ordenarBooks(libros, orden, 'saga');
  res.send(renderBookPage({libros,titlePage:`Libros de ${nombreSaga}`,tipo:'saga',nombre:nombreSaga,req}));
});

// Recomendados por rating (Goodreads) - Top 5
app.get('/recomendados', async (req,res)=>{
  try {
    const books = shuffleArray(bookMetadata.filter(b=>b && b.title && b.author)).slice(0, 200); // muestreo para respuesta rápida

    const results = [];
    const maxConcurrent = 8;
    let idx = 0;

    const worker = async () => {
      while (idx < books.length) {
        const myIndex = idx++;
        const book = books[myIndex];
        if (!book) continue;
        const rating = await fetchRating(book.title, book.author, book.isbn);
        results.push({ ...book, rating });
      }
    };

    await Promise.all(Array.from({ length: maxConcurrent }, worker));

    const top = results
      .filter(r=>r.rating > 0)
      .sort((a,b)=> b.rating - a.rating)
      .slice(0,5);

    const cards = top.map(r=>{
      const cover = getCoverForBook(r.id);
      const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#333;border-radius:5px;"></div>`;
      return `<div class="book" style="align-items:flex-start;gap:6px;">
        <div style="position:absolute;top:4px;right:6px;background:#19E6D6;color:#000;padding:2px 6px;border-radius:6px;font-size:11px;font-family:'MedievalSharp', cursive;">GR ${r.rating.toFixed(2)}</div>
        ${imgHtml}
        <div class="title" style="margin-top:6px;">${r.title}</div>
        <div class="author-span" style="margin-top:2px;">${r.author}</div>
        ${r.saga?.name ? `<div class="number-span" style="margin-top:2px;">${r.saga.name}${r.saga.number?` #${r.saga.number}`:''}</div>` : ''}
        <div class="meta" style="margin-top:4px;"><a href="/libro?id=${encodeURIComponent(r.id)}">Ver</a></div>
      </div>`;
    }).join('') || getRandomNoResultHtml();

    res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recomendados (Top 5)</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1>Top 5 recomendados</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/sagas">Sagas</a>
      <a href="/autores">Autores</a>
    </div>
  </div>

  <div style="padding:30px 20px 20px 20px; max-width:1100px; margin:0 auto;">
    <p style="color:#ccc; font-family:'MedievalSharp', cursive;">Ranking calculado con ratings de Goodreads (autocomplete). Se muestran solo libros con puntaje disponible.</p>
    <div id="grid">${cards}</div>
    <p><a href="/" class="button">← Volver</a></p>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error(err);
    res.send('<p>Error al cargar recomendados.</p>');
  }
});

// Libro individual -> muestra sinopsis + portada
app.get('/libro', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.redirect('/libros');
  
  // Usar endpoint /api/book-data para obtener/cachear datos
  let meta = bookMetadata.find(b => b.id === id);
  if (!meta) return res.redirect('/libros');
  
  // Si no tiene datos completos, buscarlos
  if (!meta.description || meta.averageRating === undefined) {
    try {
      const response = await axios.get(`http://localhost:${PORT}/api/book-data?id=${id}`);
      meta = response.data;
    } catch (err) {
      console.error('[/libro] Error al obtener datos:', err.message);
    }
  }
  
  const cover = meta.coverUrl || getCoverForBook(id);
  const title = meta.title || 'Sin título';
  const author = meta.author || 'Desconocido';
  const saga = meta.saga?.name || null;
  const synopsis = meta.description || 'No se encontró sinopsis.';
  const rating = meta.averageRating ? `⭐ ${meta.averageRating}/5 (${meta.ratingsCount || 'sin votos'})` : '';
  const publisher = meta.publisher || null;
  const publishedDate = meta.publishedDate || null;
  const pageCount = meta.pageCount || null;
  const categories = meta.categories || [];
  const language = meta.language || null;

  const synopsisHtml = `<div style="max-width:760px;margin:18px auto;color:#ddd;line-height:1.8;font-size:27px;">${synopsis}</div>`;
  
  // Info de Google Books para mostrar arriba (junto a autor y saga)
  const googleBooksInfoHtml = `
    ${publisher ? `<div style="color:#ddd;margin-bottom:6px;">Editorial: ${publisher}</div>` : ''}
    ${publishedDate ? `<div style="color:#ddd;margin-bottom:6px;">Publicado: ${publishedDate}</div>` : ''}
    ${pageCount ? `<div style="color:#ddd;margin-bottom:6px;">Páginas: ${pageCount}</div>` : ''}
    ${language ? `<div style="color:#ddd;margin-bottom:6px;">Idioma: ${language === 'es' ? 'Español' : language.toUpperCase()}</div>` : ''}
    ${categories.length > 0 ? `<div style="color:#ddd;margin-bottom:12px;">Categorías: ${categories.join(', ')}</div>` : ''}
  `;

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
        ${googleBooksInfoHtml}
        ${rating?`<div style="color:#FFD700;margin-bottom:12px;font-size:18px;">${rating}</div>`:''}
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
    const meta = await driveRead.files.get({ fileId: id, fields: 'name,mimeType' });
    const filename = (meta.data && meta.data.name) ? meta.data.name.replace(/\"/g, '') : `file-${id}`;
    const mime = (meta.data && meta.data.mimeType) ? meta.data.mimeType : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // stream del contenido
    const r = await driveRead.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
    r.data.on('error', err => {
      console.error('Stream error:', err);
      try { res.status(500).end(); } catch (e) {}
    });
    r.data.pipe(res);
    downloadCount++;
  } catch (err) {
    console.error('Download failed, falling back to Drive URL:', err && err.message ? err.message : err);
    // fallback: redirect al enlace público de Drive
    return res.redirect(`https://drive.google.com/uc?export=download&id=${id}`);
  }
});

// Descargar múltiples archivos como ZIP
app.post('/download-zip', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs inválidos' });
  }

  try {
    const archive = archiver('zip', { zlib: { level: 5 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="libros.zip"');

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error en ZIP' });
      }
    });

    res.on('error', (err) => {
      console.error('Response error:', err);
      archive.abort();
    });

    archive.pipe(res);

    for (const id of ids) {
      try {
        const meta = await driveRead.files.get({ fileId: id, fields: 'name' });
        const filename = (meta.data && meta.data.name) ? meta.data.name : `file-${id}`;
        const stream = await driveRead.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
        
        archive.append(stream.data, { name: filename });
      } catch (err) {
        console.warn(`Error agregando archivo ${id}:`, err.message);
      }
    }

    await archive.finalize();
    downloadCount++;
  } catch (err) {
    console.error('ZIP creation failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error creando ZIP: ' + err.message });
    }
  }
});

// Stats dashboard - protegido con contraseña
app.get('/stats', async (req, res) => {
  const pass = req.query.pass || '';
  if (pass !== '252914') {
    const randomMsg = deniedMessages[Math.floor(Math.random() * deniedMessages.length)];
    return res.status(403).send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Acceso Denegado</title><style>body{background:#111;color:#fff}</style></head>
<body style="padding:40px;">
  <h1>🔒 Acceso Denegado</h1>
  <p>${randomMsg}</p>
  <p><a href="/">Volver al inicio</a></p>
    <p style="margin-top:30px;">
      <a href="/" class="button">← Volver</a>
    </p>
  </div>
</body>
</html>`);
  }
  
  // Calcular estadísticas
  const totalLibros = bookMetadata.length;
  const totalAutores = [...new Set(bookMetadata.map(b => b.author))].length;
  const totalSagas = [...new Set(bookMetadata.filter(b => b.saga?.name).map(b => b.saga.name))].length;
  
  // Top autores
  const autorCount = {};
  bookMetadata.forEach(b => {
    autorCount[b.author] = (autorCount[b.author] || 0) + 1;
  });
  const topAutores = Object.entries(autorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  
  // Top sagas
  const sagaCount = {};
  bookMetadata.filter(b => b.saga?.name).forEach(b => {
    sagaCount[b.saga.name] = (sagaCount[b.saga.name] || 0) + 1;
  });
  const topSagas = Object.entries(sagaCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  
  const promedioLibrosPorAutor = (totalLibros / totalAutores).toFixed(1);

  // Calcular más estadísticas avanzadas
  const librosConCobertura = bookMetadata.filter(b => b.coverUrl).length;
  const librosSinCobertura = totalLibros - librosConCobertura;
  const porcentajeCob = ((librosConCobertura / totalLibros) * 100).toFixed(1);
  
  const librosConDescrip = bookMetadata.filter(b => b.description && b.description.length > 0).length;
  const porcentajeDescrip = ((librosConDescrip / totalLibros) * 100).toFixed(1);
  
  // Calcular libros incompletos
  const isEmpty = (value, fieldName) => {
    if (fieldName === 'saga') return !value || !value.name || value.name.trim() === '';
    if (fieldName === 'publishedDate') return !value || (typeof value === 'string' && value.trim() === '');
    return !value || (typeof value === 'string' && value.trim() === '');
  };
  
  let incompleteBooks = bookMetadata.filter(book => {
    const missing = [];
    if (isEmpty(book.title, 'title')) missing.push('title');
    if (isEmpty(book.author, 'author')) missing.push('author');
    if (isEmpty(book.saga, 'saga')) missing.push('saga');
    if (isEmpty(book.description, 'description')) missing.push('description');
    if (isEmpty(book.publishedDate, 'publishedDate')) missing.push('publishedDate');
    return missing.length > 0;
  });

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Dashboard - Libros Incompletos</title>
  <style>
    body { background: #111; color: #fff; font-family: Arial; padding: 20px; }
    h1 { color: #19E6D6; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background: #19E6D6; color: #000; font-weight: bold; }
    tr:hover { background: #222; }
    button { padding: 8px 15px; margin: 3px; cursor: pointer; border: none; border-radius: 4px; }
    .btn-edit { background: #19E6D6; color: #000; }
    .btn-delete { background: #ff6b6b; color: #fff; }
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 999; align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background: #222; padding: 30px; border-radius: 10px; max-width: 700px; border: 2px solid #19E6D6; }
    input, textarea { width: 100%; padding: 8px; margin: 5px 0; background: #333; border: 1px solid #555; color: #fff; border-radius: 4px; box-sizing: border-box; }
    label { display: block; margin-top: 10px; color: #19E6D6; font-weight: bold; }
  </style>
</head>
<body>

<h1>📚 Libros Incompletos (${incompleteBooks.length})</h1>

<table>
  <thead>
    <tr>
      <th>Título</th>
      <th>Autor</th>
      <th>Campos Faltantes</th>
      <th>Acciones</th>
    </tr>
  </thead>
  <tbody>
    ${incompleteBooks.map(book => `
      <tr>
        <td>${book.title || '(vacío)'}</td>
        <td>${book.author || '(vacío)'}</td>
        <td>
          ${(!book.title ? 'título, ' : '')}
          ${(!book.author ? 'autor, ' : '')}
          ${(!book.saga || !book.saga.name ? 'saga, ' : '')}
          ${(!book.description ? 'descripción, ' : '')}
          ${(!book.publishedDate ? 'fecha' : '')}
        </td>
        <td>
          <button class="btn-edit" onclick="openEditModal('${book.id}')">✏️ Editar</button>
          <button class="btn-delete" onclick="deleteBook('${book.id}')">🗑️ Eliminar</button>
        </td>
      </tr>
    `).join('')}
  </tbody>
</table>

<!-- Modal de Edición -->
<div id="edit-modal" class="modal">
  <div class="modal-content">
    <h2>Editar Libro</h2>
    <form onsubmit="saveBook(event)">
      <label>Título *</label>
      <input type="text" id="edit-title" required>
      
      <label>Autor *</label>
      <input type="text" id="edit-author" required>
      
      <label>Saga *</label>
      <input type="text" id="edit-saga" required>
      
      <label>Descripción *</label>
      <textarea id="edit-description" rows="4" required></textarea>
      
      <label>Fecha Publicación *</label>
      <input type="text" id="edit-date" required>
      
      <button type="submit" class="btn-edit">💾 Guardar</button>
      <button type="button" class="btn-delete" onclick="closeEditModal()">Cancelar</button>
    </form>
  </div>
</div>

<script>
let currentBookId = null;
let currentBook = null;

function openEditModal(bookId) {
  currentBookId = bookId;
  fetch('/api/books/' + bookId)
    .then(r => r.json())
    .then(book => {
      currentBook = book;
      document.getElementById('edit-title').value = book.title || '';
      document.getElementById('edit-author').value = book.author || '';
      document.getElementById('edit-saga').value = (book.saga && book.saga.name) || '';
      document.getElementById('edit-description').value = book.description || '';
      document.getElementById('edit-date').value = book.publishedDate || '';
      document.getElementById('edit-modal').classList.add('active');
    })
    .catch(e => alert('Error: ' + e.message));
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('active');
}

function saveBook(e) {
  e.preventDefault();
  const updated = {
    ...currentBook,
    title: document.getElementById('edit-title').value,
    author: document.getElementById('edit-author').value,
    saga: { name: document.getElementById('edit-saga').value, number: 1 },
    description: document.getElementById('edit-description').value,
    publishedDate: document.getElementById('edit-date').value
  };
  
  fetch('/api/books/' + currentBookId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated)
  })
    .then(r => r.ok ? location.reload() : alert('Error al guardar'))
    .catch(e => alert('Error: ' + e.message));
}

function deleteBook(bookId) {
  if (confirm('¿Eliminar este libro?')) {
    fetch('/api/books/' + bookId, { method: 'DELETE' })
      .then(r => r.ok ? location.reload() : alert('Error'))
      .catch(e => alert('Error: ' + e.message));
  }
}

console.log('Dashboard cargado. Botones funcionando.');
</script>

</body>
</html>`);
});

// API JSON: Obtener estadísticas (para dashboard)
app.get('/api/stats', async (req, res) => {
  reloadBooksMetadata();
  
  const totalBooks = bookMetadata.length;
  const totalAuthors = [...new Set(bookMetadata.map(b => b.author))].length;
  const totalSagas = [...new Set(bookMetadata.filter(b => b.saga?.name).map(b => b.saga.name))].length;
  
  const booksWithCovers = bookMetadata.filter(b => b.coverUrl).length;
  const incompleteBooks = bookMetadata.filter(book => {
    const requiredFields = ['title', 'author', 'description', 'coverUrl', 'pageCount', 'language', 'categories'];
    const missingFields = requiredFields.filter(field => {
      if (field === 'categories') return !book[field] || !Array.isArray(book[field]) || book[field].length === 0;
      return !book[field] || (typeof book[field] === 'string' && book[field].trim() === '');
    });
    return missingFields.length > 0;
  }).length;
  
  const googleBooksSynced = bookMetadata.filter(b => b.averageRating).length;
  
  res.json({
    totalBooks,
    totalAuthors,
    totalSagas,
    booksWithCovers,
    incompleteBooks,
    googleBooksSynced
  });
});

// API: Obtener portada de Google Books y guardar en JSON
app.get('/api/book-cover', async (req, res) => {
  const { title, author, id } = req.query;
  if (!title || !author) return res.status(400).json({ error: 'Faltan parámetros' });

  try {
    // Buscar en books.json
    let book = bookMetadata.find(b => b.id === id || (b.title.toLowerCase() === title.toLowerCase() && b.author.toLowerCase() === author.toLowerCase()));
    
    // Si ya tiene coverUrl, devolverlo
    if (book?.coverUrl) {
      console.log(`[API /book-cover] ✅ En caché: ${title}`);
      return res.json({ coverUrl: book.coverUrl, cached: true });
    }

    // Buscar en Google Books
    console.log(`[API /book-cover] Buscando: ${title}`);
    const data = await fetchGoogleBooksData(title, author);
    const coverUrl = data?.imageLinks?.thumbnail || data?.imageLinks?.smallThumbnail;

    if (coverUrl && book) {
      book.coverUrl = coverUrl;
      await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
      return res.json({ coverUrl: coverUrl, cached: false });
    }

    // Si no se encontró en Google Books, usar imagen aleatoria de fallback
    const fallbackCover = getRandomCoverImage();
    if (fallbackCover && book) {
      book.coverUrl = fallbackCover;
      await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
      console.log(`[API /book-cover] 🎲 Fallback asignado: ${fallbackCover} para ${title}`);
      return res.json({ coverUrl: fallbackCover, cached: false, fallback: true });
    }

    res.json({ coverUrl: coverUrl || fallbackCover || null, cached: false, fallback: !!fallbackCover });
  } catch (err) {
    console.error('[API /book-cover] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Obtener datos completos del libro desde Google Books y guardar TODO en JSON
app.get('/api/book-data', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Falta id' });

  try {
    let book = bookMetadata.find(b => b.id === id);
    if (!book) return res.status(404).json({ error: 'No encontrado' });

    // Si ya tiene TODOS los datos principales, devolverlo sin buscar
    if (book.description && book.averageRating !== undefined && book.publisher && book.pageCount) {
      console.log(`[API /book-data] ✅ En caché (completo): ${book.title}`);
      return res.json({ ...book, cached: true });
    }

    // Buscar en Google Books para rellenar datos faltantes
    console.log(`[API /book-data] 🔄 Buscando datos de: ${book.title}`);
    const data = await fetchGoogleBooksData(book.title, book.author);

    if (data) {
      // Actualizar TODOS los campos del libro
      book.coverUrl = data.imageLinks?.thumbnail || data.imageLinks?.smallThumbnail || book.coverUrl || null;
      book.description = data.description || book.description || null;
      book.publisher = data.publisher || book.publisher || null;
      book.publishedDate = data.publishedDate || book.publishedDate || null;
      book.pageCount = data.pageCount || book.pageCount || null;
      book.categories = data.categories || book.categories || [];
      book.language = data.language || book.language || null;
      book.averageRating = data.averageRating !== undefined ? data.averageRating : (book.averageRating || null);
      book.ratingsCount = data.ratingsCount || book.ratingsCount || 0;
      book.previewLink = data.previewLink || book.previewLink || null;
      book.imageLinks = data.imageLinks || book.imageLinks || null;
      
      // Guardar cambios en JSON
      await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
      console.log(`[API /book-data] ✅ Datos guardados: ${book.title}`);
    }

    // Si no tiene coverUrl después de buscar, asignar fallback aleatorio
    if (!book.coverUrl) {
      const fallbackCover = getRandomCoverImage();
      if (fallbackCover) {
        book.coverUrl = fallbackCover;
        await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
        console.log(`[API /book-data] 🎲 Fallback asignado: ${fallbackCover} para ${book.title}`);
      }
    }

    res.json({ ...book, cached: data ? false : true });
  } catch (err) {
    console.error('[API /book-data] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Función para eliminar duplicados basados en título, autor y saga
function removeDuplicateBooks(books) {
  const seen = new Map();
  const unique = [];
  let duplicatesRemoved = 0;

  books.forEach(book => {
    const key = `${(book.title || '').toLowerCase().trim()}|${(book.author || '').toLowerCase().trim()}|${(book.saga?.name || '').toLowerCase().trim()}|${book.saga?.number || 0}`;
    
    if (!seen.has(key)) {
      seen.set(key, book);
      unique.push(book);
    } else {
      // Ya existe, comparar cuál tiene más datos
      const existing = seen.get(key);
      const existingFields = [existing.coverUrl, existing.description, existing.publisher, existing.pageCount].filter(Boolean).length;
      const newFields = [book.coverUrl, book.description, book.publisher, book.pageCount].filter(Boolean).length;
      
      if (newFields > existingFields) {
        // Reemplazar con el que tiene más datos
        const idx = unique.indexOf(existing);
        unique[idx] = book;
        seen.set(key, book);
        console.log(`[DEDUP] 🔄 Reemplazando "${book.title}" (más completo)`);
      } else {
        console.log(`[DEDUP] ❌ Eliminando duplicado: "${book.title}" (ID: ${book.id})`);
      }
      duplicatesRemoved++;
    }
  });

  if (duplicatesRemoved > 0) {
    console.log(`[DEDUP] ✅ ${duplicatesRemoved} duplicados eliminados`);
  }

  return unique;
}

// API: Sincronizar metadatos de libros nuevos en Drive
app.get('/api/sync-drive-metadata', async (req, res) => {
  try {
    console.log(`[SYNC] 🔄 Iniciando sincronización de metadatos con Drive...`);
    
    // Obtener archivos del Drive
    const allFiles = await listAllFiles(folderId);
    let librosNuevos = 0;
    let datosActualizados = 0;

    for (const file of allFiles) {
      const parsed = parseDriveFileName(file.name);
      let book = bookMetadata.find(b => b.id === file.id);
      
      if (!book) {
        // Libro nuevo del Drive - usar datos parseados del nombre
        book = {
          id: file.id,
          driveFileId: file.id,
          title: parsed.title,
          author: parsed.author,
          saga: { name: parsed.sagaName, number: parsed.sagaNumber },
          createdTime: file.createdTime || new Date().toISOString()
        };
        bookMetadata.push(book);
        librosNuevos++;
        console.log(`[SYNC] ➕ Nuevo libro: ${book.title} - ${book.author}`);
      } else {
        // Completar metadata básica con lo que venga del nombre de archivo
        if (!book.title && parsed.title) book.title = parsed.title;
        if (!book.author && parsed.author) book.author = parsed.author;
        if (!book.saga) book.saga = { name: parsed.sagaName, number: parsed.sagaNumber };
        if (book.saga && !book.saga.name && parsed.sagaName) book.saga.name = parsed.sagaName;
        if (book.saga && (!book.saga.number || book.saga.number === 0) && parsed.sagaNumber) book.saga.number = parsed.sagaNumber;
        if (!book.createdTime) book.createdTime = file.createdTime || new Date().toISOString();
      }

      // Buscar datos en Google Books si faltan campos relevantes
      const needsGoogle = !book.description || !book.coverUrl || !book.pageCount || !book.categories || book.categories.length === 0 || !book.language || !book.publisher || !book.previewLink || book.averageRating == null;
      if (needsGoogle) {
        const data = await fetchGoogleBooksData(book.title, book.author);
        const updated = mergeGoogleDataIntoBook(book, data);
        if (!book.coverUrl) {
          const fallback = getRandomCoverImage();
          if (fallback) { book.coverUrl = fallback; }
        }
        if (updated) {
          datosActualizados++;
          console.log(`[SYNC] 📚 Metadatos actualizados: ${book.title}`);
        }
      }
    }

    // Eliminar duplicados antes de guardar
    const beforeCount = bookMetadata.length;
    bookMetadata = removeDuplicateBooks(bookMetadata);
    const duplicatesRemoved = beforeCount - bookMetadata.length;

    // Guardar cambios
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    
    res.json({ 
      success: true, 
      totalLibros: bookMetadata.length,
      librosNuevos,
      datosActualizados,
      duplicatesRemoved,
      mensaje: `Sincronización completada. ${librosNuevos} libros nuevos, ${datosActualizados} actualizados, ${duplicatesRemoved} duplicados eliminados.`
    });
  } catch (err) {
    console.error('[SYNC] Error:', err.message);
      res.status(500).json({ error: err.message });
  }
});

// Página de upload de EPUB
app.get('/upload', (req, res) => {
  const pass = req.query.pass || '';
  if (pass !== '252914') {
    return res.status(403).redirect('/');
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cargar EPUB - Azkaban Reads</title>
  <link rel="preload" as="image" href="/cover/secuendarias/portada11.png">
  <style>${css}</style>
  <style>
    .upload-container { max-width: 900px; margin: 40px auto; padding: 40px; }
    .drop-zone { border: 3px dashed #19E6D6; border-radius: 12px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.3s; background: rgba(25,230,214,0.05); }
    .drop-zone.hover { background: rgba(25,230,214,0.15); border-color: #00d4d4; }
    .file-input { display: none; }
    .file-list { margin-top: 30px; display: grid; gap: 20px; }
    .file-card { padding: 20px; background: linear-gradient(135deg, rgba(25,25,25,0.95), rgba(18,18,18,0.9)); border: 1px solid rgba(25,230,214,0.2); border-radius: 12px; }
    .file-card h4 { color: #19E6D6; margin: 0 0 15px 0; font-family: 'MedievalSharp', cursive; }
    .form-group { margin-bottom: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .form-group.full { grid-template-columns: 1fr; }
    input, textarea { width: 100%; padding: 10px; border: 2px solid rgba(25,230,214,0.3); background: rgba(25,25,25,0.8); color: #fff; border-radius: 6px; font-family: inherit; box-sizing: border-box; }
    input:focus, textarea:focus { border-color: #19E6D6; outline: none; }
    .required::after { content: ' *'; color: #ff6b6b; }
    .upload-btn { width: 100%; padding: 15px; margin-top: 20px; background: #19E6D6; color: #000; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 16px; font-family: 'MedievalSharp', cursive; transition: all 0.3s; }
    .upload-btn:hover:not(:disabled) { transform: scale(1.02); box-shadow: 0 0 20px rgba(25,230,214,0.5); }
    .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .progress { display: none; margin-top: 20px; text-align: center; color: #19E6D6; }
    .status-message { padding: 15px; border-radius: 6px; margin-top: 15px; display: none; }
    .status-message.success { background: rgba(76, 175, 80, 0.2); border: 1px solid #4CAF50; color: #4CAF50; }
    .status-message.error { background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; color: #ff6b6b; }
  </style>
</head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1 style="display:flex;align-items:center;gap:12px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#19E6D6;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>Uploads</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/autores">Autores</a>
      <a href="/sagas">Sagas</a>
    </div>
  </div>

  <div class="upload-container">
    <div class="drop-zone" id="dropZone">
      <div style="font-size: 0px; margin-bottom: 10px;"></div>
      <p style="color: #19E6D6; font-size: 18px; font-weight: bold; margin: 10px 0;">Arrastra archivos EPUB aquí</p>
      <p style="color: #999; margin: 10px 0;">o haz clic para seleccionar</p>
      <input type="file" id="fileInput" class="file-input" accept=".epub" multiple>
    </div>

    <div class="file-list" id="fileList"></div>
    
    <button class="upload-btn" id="submitBtn" disabled>Cargar Archivos a Drive</button>
    <div id="statusMessage" class="status-message"></div>
    <div class="progress" id="progress">
      <p>Cargando... <span id="progressText">0%</span></p>
    </div>
  </div>

  <script>
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const submitBtn = document.getElementById('submitBtn');
    const statusMessage = document.getElementById('statusMessage');
    const progress = document.getElementById('progress');
    const progressText = document.getElementById('progressText');
    const passParam = new URLSearchParams(window.location.search).get('pass') || '';

    let files = [];

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.add('hover'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove('hover'));
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const newFiles = dt.files;
      handleFiles(newFiles);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleFiles(newFiles) {
      files = Array.from(newFiles);
      renderFileList();
    }

    function renderFileList() {
      fileList.innerHTML = '';
      files.forEach((file, index) => {
        const fileName = file.name.replace('.epub', '');
        const fileCard = document.createElement('div');
        fileCard.className = 'file-card';
        fileCard.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
          '<h4>📖 ' + fileName + '</h4>' +
          '<button onclick="removeFile(' + index + ')" style="padding: 5px 10px; background: #ff6b6b; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button>' +
          '</div>' +
          '<div class="form-group full">' +
          '<label style="color: #19E6D6; font-weight: bold;">Nombre del Libro <span class="required"></span></label>' +
          '<input type="text" class="book-title" data-index="' + index + '" value="' + fileName + '" placeholder="Nombre">' +
          '</div>' +
          '<div class="form-group full">' +
          '<label style="color: #19E6D6; font-weight: bold;">Autor <span class="required"></span></label>' +
          '<input type="text" class="book-author" data-index="' + index + '" placeholder="Autor">' +
          '</div>' +
          '<div class="form-group">' +
          '<div>' +
          '<label style="color: #19E6D6; font-weight: bold;">Saga <span class="required"></span></label>' +
          '<input type="text" class="book-saga" data-index="' + index + '" placeholder="Nombre de la saga">' +
          '</div>' +
          '<div>' +
          '<label style="color: #19E6D6; font-weight: bold;">Número en Saga <span class="required"></span></label>' +
          '<input type="number" class="book-saga-number" data-index="' + index + '" value="1" min="0">' +
          '</div>' +
          '</div>' +
          '<div class="form-group full">' +
          '<label style="color: #19E6D6; font-weight: bold;">Descripción (Opcional)</label>' +
          '<textarea class="book-description" data-index="' + index + '" placeholder="Descripción del libro" rows="3"></textarea>' +
          '</div>';
        fileList.appendChild(fileCard);
      });
      updateSubmitBtn();
    }

    function removeFile(index) {
      files.splice(index, 1);
      renderFileList();
    }

    function updateSubmitBtn() {
      const allValid = files.length > 0 && files.every((file, index) => {
        const title = document.querySelector('.book-title[data-index="' + index + '"]')?.value;
        const author = document.querySelector('.book-author[data-index="' + index + '"]')?.value;
        const saga = document.querySelector('.book-saga[data-index="' + index + '"]')?.value;
        return title && author && saga;
      });
      submitBtn.disabled = !allValid;
    }

    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('book-title') || 
          e.target.classList.contains('book-author') || 
          e.target.classList.contains('book-saga')) {
        updateSubmitBtn();
      }
    });

    submitBtn.addEventListener('click', async () => {
      if (files.length === 0) return;

      submitBtn.disabled = true;
      progress.style.display = 'block';
      statusMessage.style.display = 'none';

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const title = document.querySelector('.book-title[data-index="' + i + '"]').value;
          const author = document.querySelector('.book-author[data-index="' + i + '"]').value;
          const saga = document.querySelector('.book-saga[data-index="' + i + '"]').value;
          const sagaNumber = document.querySelector('.book-saga-number[data-index="' + i + '"]').value;
          const description = document.querySelector('.book-description[data-index="' + i + '"]').value;

          const formData = new FormData();
          formData.append('file', file);
          formData.append('title', title);
          formData.append('author', author);
          formData.append('saga', saga);
          formData.append('sagaNumber', sagaNumber);
          formData.append('description', description);

          const uploadUrl = '/api/upload-to-drive' + (passParam ? ('?pass=' + encodeURIComponent(passParam)) : '');
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: passParam ? { 'x-api-key': passParam } : {},
            body: formData
          });

          if (!response.ok) {
            // Intentar mostrar el mensaje real del backend para depurar mejor
            let errorMessage = 'Error uploading file';
            try {
              const errorJson = await response.json();
              errorMessage = errorJson?.error || errorMessage;
            } catch (_) {
              try {
                errorMessage = await response.text();
              } catch (_) {
                // ignore
              }
            }
            throw new Error(errorMessage);
          }
          
          progressText.textContent = Math.round(((i + 1) / files.length) * 100) + '%';
        }

        statusMessage.className = 'status-message success';
        statusMessage.textContent = '✅ Todos los archivos cargados correctamente a Drive';
        statusMessage.style.display = 'block';
        progress.style.display = 'none';
        files = [];
        renderFileList();
      } catch (err) {
        statusMessage.className = 'status-message error';
        statusMessage.textContent = '❌ Error: ' + err.message;
        statusMessage.style.display = 'block';
        progress.style.display = 'none';
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// API: Sincronizar datos de Google Books para libros sin portada/descripción
app.get('/api/sync-google-books', async (req, res) => {
  try {
    const pass = req.query.pass || '';
    if (pass !== '252914') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    reloadBooksMetadata();
    
    // Encontrar libros sin datos completos de Google Books
    const booksToSync = bookMetadata.filter(b => 
      !b.coverUrl || !b.description || !b.publisher || !b.pageCount || !b.categories || b.categories.length === 0
    );
    
    if (booksToSync.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Todos los libros tienen datos completos de Google Books',
        updated: 0,
        total: bookMetadata.length
      });
    }

    console.log(`[SYNC-GBOOKS] 🔍 Sincronizando ${booksToSync.length} libros...`);
    
    let updated = 0;
    for (const book of booksToSync) {
      try {
        const googleBooksData = await fetchGoogleBooksData(book.title, book.author);
        if (googleBooksData) {
          // Actualizar todos los campos de Google Books
          if (!book.description && googleBooksData.description) {
            book.description = googleBooksData.description;
          }
          if (!book.coverUrl && googleBooksData.imageLinks?.thumbnail) {
            book.coverUrl = googleBooksData.imageLinks.thumbnail;
          }
          if (!book.imageLinks && googleBooksData.imageLinks) {
            book.imageLinks = googleBooksData.imageLinks;
          }
          if (!book.publisher && googleBooksData.publisher) {
            book.publisher = googleBooksData.publisher;
          }
          if (!book.publishedDate && googleBooksData.publishedDate) {
            book.publishedDate = googleBooksData.publishedDate;
          }
          if (!book.pageCount && googleBooksData.pageCount) {
            book.pageCount = googleBooksData.pageCount;
          }
          if (!book.categories || book.categories.length === 0) {
            book.categories = googleBooksData.categories || [];
          }
          if (!book.language && googleBooksData.language) {
            book.language = googleBooksData.language;
          }
          if (!book.averageRating && googleBooksData.averageRating) {
            book.averageRating = googleBooksData.averageRating;
            book.ratingsCount = googleBooksData.ratingsCount;
          }
          if (!book.previewLink && googleBooksData.previewLink) {
            book.previewLink = googleBooksData.previewLink;
          }
          console.log(`[SYNC-GBOOKS] ✅ ${book.title}: datos actualizados`);
          updated++;
        }
      } catch (err) {
        console.warn(`[SYNC-GBOOKS] Error sincronizando ${book.title}:`, err.message);
      }
    }

    // Guardar cambios
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`[SYNC-GBOOKS] ✅ Sincronización completada: ${updated}/${booksToSync.length} libros actualizados`);

    res.json({ 
      success: true, 
      message: `Se actualizaron ${updated} libros con datos de Google Books`,
      updated,
      total: bookMetadata.length,
      synced: updated > 0
    });
  } catch (err) {
    console.error('[SYNC-GBOOKS] Error:', err.message);
    res.status(500).json({ error: 'Error sincronizando con Google Books: ' + err.message });
  }
});

// API: Subir EPUB a Drive
app.post('/api/upload-to-drive', upload.single('file'), async (req, res) => {
  try {
    const pass = req.query.pass || '';
    const apiKey = req.headers['x-api-key'] || '';
    if (pass !== '252914' && apiKey !== '252914') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!driveUpload) {
      return res.status(500).json({ error: 'Google Drive no está inicializado' });
    }

    // Evitar intentos con Service Account (sin cuota de subida)
    if (!hasOAuth) {
      return res.status(503).json({ error: 'Subidas deshabilitadas: falta OAuth configurado en el servidor (no se puede usar Service Account para subir)' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { title, author, saga, sagaNumber, description } = req.body;
    if (!title || !author || !saga) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const fileName = `${title} - ${author} (${saga} #${sagaNumber || 1}).epub`;

    // Subir a Drive en la carpeta compartida existente
    let driveFileId = null;
    let driveCreatedTime = new Date().toISOString();
    try {
      const uploadResp = await driveUpload.files.create({
        requestBody: {
          name: fileName,
          parents: folderId ? [folderId] : []
        },
        media: {
          mimeType: req.file.mimetype || 'application/epub+zip',
          body: bufferToStream(req.file.buffer)
        },
        fields: 'id,name,parents,createdTime'
      });

      driveFileId = uploadResp.data.id;
      driveCreatedTime = uploadResp.data.createdTime || driveCreatedTime;
      console.log(`[UPLOAD] ☁️ Subido a Drive: ${fileName} (ID: ${driveFileId})`);
    } catch (err) {
      console.error('[UPLOAD] Error subiendo a Drive:', err.message);
      return res.status(500).json({ error: 'No se pudo subir a Drive: ' + err.message });
    }

    // Buscar datos completos en Google Books (solo para complementar)
    console.log(`[UPLOAD] 🔍 Buscando datos en Google Books para: ${title} - ${author}`);
    const googleBooksData = await fetchGoogleBooksData(title, author);
    if (googleBooksData) {
      console.log(`[UPLOAD] ✅ Google Books: descripción=${googleBooksData.description ? '✅' : '❌'}, portada=${googleBooksData.imageLinks?.thumbnail ? '✅' : '❌'}`);
    } else {
      console.log(`[UPLOAD] ⚠️ No se encontraron datos en Google Books`);
    }

    // Preparar libro: usar datos del formulario y enriquecer con Google Books sin sobreescribir lo ya enviado
    const book = {
      id: driveFileId,
      driveFileId,
      title,
      author,
      saga: {
        name: saga,
        number: parseInt(sagaNumber) || 1
      },
      description: description || null,
      publisher: null,
      publishedDate: new Date().toISOString().split('T')[0],
      pageCount: null,
      categories: [],
      language: 'es',
      averageRating: null,
      ratingsCount: null,
      imageLinks: null,
      previewLink: null,
      coverUrl: null,
      uploadDate: new Date().toISOString(),
      createdTime: driveCreatedTime
    };

    const merged = mergeGoogleDataIntoBook(book, googleBooksData);
    if (!book.coverUrl) {
      const fallback = getRandomCoverImage();
      if (fallback) book.coverUrl = fallback;
    }
    if (!book.categories) book.categories = [];
    if (!book.language) book.language = 'es';
    console.log(`[UPLOAD] 📚 Libro enriquecido: ${merged ? '✅ Google Books' : '⚠️ Sin datos de Google (fallback)'}`);

    // Reemplazar si ya existe el ID en memoria
    bookMetadata = bookMetadata.filter(b => b.id !== driveFileId);
    bookMetadata.push(book);
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));

    console.log(`[UPLOAD] ✅ Libro registrado: ${fileName} (ID: ${driveFileId})`);
    console.log(`[UPLOAD] 📚 Libro agregado con portada: ${book.coverUrl ? '✅ Encontrada' : '❌ Fallback'}`);
    
    res.json({ 
      success: true, 
      fileId: driveFileId,
      fileName: fileName,
      coverUrl: book.coverUrl,
      driveUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
      message: 'Archivo cargado correctamente a Drive'
    });
  } catch (err) {
    console.error('[UPLOAD] Error:', err.message);
    res.status(500).json({ error: err.message || 'Error procesando archivo' });
  }
});

// Dashboard: Servir editor de libros
app.get('/dashboard', (req, res) => {
  const pass = req.query.pass || '';
  if (pass !== '252914') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API: Obtener todos los libros
app.get('/api/books', async (req, res) => {
  reloadBooksMetadata();
  res.json(bookMetadata);
});

// API: Obtener libros incompletos (con campos faltantes)
app.get('/api/books/incomplete', async (req, res) => {
  reloadBooksMetadata();
  
  // Definir campos requeridos para considerar un libro COMPLETO
  // Un libro es incompleto si le falta: título, autor, saga, descripción o año
  const requiredFields = ['title', 'author', 'saga', 'description', 'publishedDate'];
  
  // Función para verificar si un campo está vacío
  const isEmpty = (value, fieldName) => {
    if (fieldName === 'saga') {
      return !value || !value.name || (typeof value.name === 'string' && value.name.trim() === '');
    }
    if (fieldName === 'publishedDate') {
      return !value || (typeof value === 'string' && value.trim() === '');
    }
    // Para otros campos
    return !value || (typeof value === 'string' && value.trim() === '');
  };
  
  // Encontrar libros incompletos
  const incompleteBooks = bookMetadata.filter(book => {
    const missingFields = requiredFields.filter(field => isEmpty(book[field], field));
    return missingFields.length > 0;
  }).map(book => {
    const missingFields = requiredFields.filter(field => isEmpty(book[field], field));
    return {
      id: book.id,
      title: book.title || 'Sin título',
      author: book.author || 'Desconocido',
      saga: book.saga || { name: 'Sin saga', number: 0 },
      description: book.description || null,
      publishedDate: book.publishedDate || null,
      missingFields
    };
  }).sort((a, b) => b.missingFields.length - a.missingFields.length);
  
  res.json({ total: incompleteBooks.length, books: incompleteBooks });
});

// API: Obtener libro individual
app.get('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  reloadBooksMetadata();
  
  const book = bookMetadata.find(b => b.id === id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado' });
  
  res.json(book);
});

// API: Actualizar libro
app.put('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  
  reloadBooksMetadata();
  
  const bookIndex = bookMetadata.findIndex(b => b.id === id);
  if (bookIndex === -1) return res.status(404).json({ error: 'Libro no encontrado' });
  
  // Validar que no se pierdan campos críticos
  const book = bookMetadata[bookIndex];
  const validated = {
    ...book,
    ...updatedData,
    id: book.id, // Proteger el ID
    uploadDate: book.uploadDate, // Proteger fecha original
    createdTime: book.createdTime // Proteger timestamp de Drive
  };
  
  // Actualizar en memoria
  bookMetadata[bookIndex] = validated;
  
  // Guardar a disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`[API /books/:id PUT] ✅ Libro actualizado: ${validated.title} (ID: ${id})`);
    res.json({ success: true, book: validated });
  } catch (err) {
    console.error('[API /books/:id PUT] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Eliminar libro por ID
app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  
  reloadBooksMetadata();
  
  const bookIndex = bookMetadata.findIndex(b => b.id === id);
  if (bookIndex === -1) return res.status(404).json({ error: 'Libro no encontrado' });
  
  const deletedBook = bookMetadata[bookIndex];
  
  // Eliminar del array
  bookMetadata.splice(bookIndex, 1);
  
  // Guardar a disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`[API /books/:id DELETE] ✅ Libro eliminado: ${deletedBook.title} (ID: ${id})`);
    res.json({ success: true, message: 'Libro eliminado correctamente' });
  } catch (err) {
    console.error('[API /books/:id DELETE] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT,()=>console.log(`Servidor escuchando en puerto ${PORT}`));