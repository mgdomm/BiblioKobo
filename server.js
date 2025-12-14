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

// Servir carpeta cover con caché agresivo (7 días para portadas estáticas)
app.use('/cover', express.static(path.join(__dirname, 'cover'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  immutable: true
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

// Contadores simples de descargas y uploads (memoria)
let downloadCount = 0;
let uploadCount = 0;

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
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.jpg');"></div>
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
.header-banner.top { position:fixed; top:0; left:0; right:0; height:220px; z-index:1; background-position: center 50%; background-size:cover; }
.header-banner.home { position:relative; height:100vh; background-position: center 50%; background-size:cover; }
.header-banner::after { content:""; position:absolute; left:0; right:0; bottom:0; height:40%; background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.95) 100%); pointer-events:none; }

.overlay { display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding-bottom:25px; text-align:center; }
.overlay.top { position:fixed; top:0; left:0; width:100%; height:220px; z-index:2; }
.overlay.home { position:absolute; top:0; left:0; width:100%; height:100vh; z-index:2; display:flex; justify-content:center; align-items:center; }

h1 { font-family:'MedievalSharp', cursive; font-size:56px; color:#fff; margin:0; text-shadow: 0 2px 6px rgba(0,0,0,0.9); }

.top-buttons { display:flex; justify-content:center; flex-wrap:wrap; margin-bottom:6px; }
/* primary buttons: visible, subtle bg, no harsh border */
.top-buttons a { font-family:'MedievalSharp', cursive; font-size:24px; color:#fff; text-decoration:none; border-radius:6px; padding:8px 16px; margin:2px; background:rgba(255,255,255,0.06); transition:0.2s; }
.top-buttons a:hover { background:rgba(255,255,255,0.12); }
.top-buttons.secondary { position:absolute; top:10px; right:10px; font-size:16px; }
/* secondary (Inicio) should be plain text, no border */
.top-buttons.secondary a { color:#fff; text-decoration:none; border:none; padding:6px 10px; background:transparent; font-size:18px; }

form { margin:20px 0; text-align:center; }
input[type="search"] { padding:8px 12px; margin:0 4px; font-size:16px; border-radius:6px; border:2px solid #19E6D6; background:#111; color:#fff; font-family:'MedievalSharp', cursive; font-weight:normal; transition:0.2s; }
input[type="search"]:focus { outline:none; border-color:#19E6D6; box-shadow:0 0 8px rgba(25,230,214,0.4); }
select { padding:8px 12px; margin:0 4px; font-size:16px; border-radius:6px; border:2px solid #fff; background:#111; color:#fff; font-family:'MedievalSharp', cursive; font-weight:normal; transition:0.2s; }
select:focus { outline:none; border-color:#fff; box-shadow:0 0 8px rgba(255,255,255,0.4); }
button[type="submit"] { padding:8px 16px; font-family:'MedievalSharp', cursive; font-weight:normal; font-size:16px; border:2px solid #19E6D6; background:#111; color:#fff; border-radius:6px; cursor:pointer; transition:0.2s; }
button[type="submit"]:hover { background:#19E6D6; color:#000; }

#grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 130px)); gap:30px; padding:30px 20px 40px 20px; max-width:100%; margin:0 auto; justify-content:center; }
.book { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; width:130px; min-height:auto; background:linear-gradient(180deg, rgba(18,18,18,0.92), rgba(12,12,12,0.9)); padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,0.04); text-align:center; word-wrap:break-word; transition:opacity 0.3s, transform 0.15s; box-shadow:0 6px 18px rgba(0,0,0,0.6); }
.book img { width:90px; height:140px; border-radius:6px; object-fit:cover; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto; }
.title { font-size:15px; font-weight:700; color:#fff; font-family:'MedievalSharp', cursive; margin:0 0 6px 0; padding:6px 4px 6px 4px; border-bottom:1px solid rgba(255,255,255,0.04); line-height:1.4; }
.title a { color: inherit; text-decoration: none; display:block; padding:0; }
.author-span, .number-span { font-size:13px; color:#ddd; font-family:'MedievalSharp', cursive; font-weight:400; display:block; margin-top:4px; padding:0 2px; line-height:1.3; }
.author-span a { color:#fff; text-decoration:none; font-style:italic; font-weight:400; }
.number-span a { color:#19E6D6; text-decoration:none; font-weight:600; font-size:12px; text-transform:uppercase; }
.meta a { font-size:13px; font-weight:bold; text-decoration:none; color:#fff; background:rgba(34,34,34,0.7); padding:4px 8px; border-radius:4px; display:inline-block; margin-top:4px; transition:0.2s; }
.meta a:hover { background:rgba(68,68,68,0.9); }
.author-span a:hover, .number-span a:hover { color:#fff; text-decoration:none; opacity:0.9; }
a.button { display:inline-block; margin:10px; text-decoration:none; padding:16px 32px; background:#222; color:#fff; border-radius:8px; font-size:22px; font-weight:bold; transition:0.2s; }
a.button:hover { background:#444; }

/* Avatares para autores y emblemas para sagas */
.card-block { display:flex; flex-direction:column; align-items:center; gap:8px; }
.avatar-rect { width:90px; height:120px; border-radius:8px; background:linear-gradient(160deg, rgba(40,40,40,0.9), rgba(18,18,18,0.9)); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-family:'MedievalSharp', cursive; font-size:32px; color:#fff; letter-spacing:1px; text-shadow:0 2px 6px rgba(0,0,0,0.6); }
.count-badge { margin-top:-4px; font-size:13px; color:#19E6D6; background:rgba(25,230,214,0.12); border:1px solid rgba(25,230,214,0.5); padding:4px 10px; border-radius:999px; font-family:Garamond, serif; }
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
.login-box input { width:100%; padding:14px; margin:10px 0; border:1px solid rgba(25,230,214,0.4); background:rgba(25,25,25,0.8); color:#fff; border-radius:6px; font-size:17px; box-sizing:border-box; }
.login-box input:focus { outline:none; border-color:#19E6D6; box-shadow:0 0 8px rgba(25,230,214,0.4); }
.login-box button { padding:12px 24px; margin:10px 5px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:#19E6D6; color:#000; font-size:17px; }
.login-box button:hover { background:#1dd4c8; }
.login-box button.cancel { background:rgba(255,255,255,0.1); color:#fff; }
.login-box button.cancel:hover { background:rgba(255,255,255,0.2); }
.hidden-stats-btn { position:fixed; bottom:20px; right:20px; width:44px; height:44px; background:transparent; border:1px solid #19E6D6; border-radius:50%; color:#19E6D6; cursor:pointer; z-index:100; transition:0.25s; display:flex; align-items:center; justify-content:center; padding:0; }
.hidden-stats-btn svg { width:22px; height:22px; fill:none; stroke:#19E6D6; stroke-width:2.2; filter:drop-shadow(0 0 4px rgba(25,230,214,0.4)); }
.hidden-stats-btn:hover { box-shadow:0 0 10px rgba(25,230,214,0.4), 0 0 20px rgba(25,230,214,0.2); transform:scale(1.08); }

/* ensure content sits below fixed top banner */
body { padding-top:220px; }

/* Desktop: 50px más que antes (240 + 50 = 290px) */
@media (min-width: 1024px) {
  .header-banner.top { height:290px; }
  .overlay.top { height:290px; }
  body { padding-top:290px; }
}

/* Tablet: 30px más que antes (200 + 30 = 230px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .header-banner.top { height:230px; }
  .overlay.top { height:230px; }
  body { padding-top:230px; }
}

/* Mobile: 20px más que antes (200 + 20 = 220px) */
@media (max-width: 767px) {
  .header-banner.top { height:220px; }
  .overlay.top { height:220px; }
  body { padding-top:220px; }
  h1 { font-size:38px; }
  .header-banner.home { background-size:80%; background-repeat:no-repeat; }
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
        // Normalizar título y autor: remover acentos pero preservar ñ/Ñ
        const normalizeText = (text) => {
          return text
            .replace(/ñ/g, 'ñ') // Preservar ñ minúscula
            .replace(/Ñ/g, 'Ñ') // Preservar Ñ mayúscula
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remover otros acentos
            .replace(/[^a-zA-ZñÑ0-9\s]/g, ' ') // Permitir ñ/Ñ en caracteres válidos
            .replace(/\s+/g, ' ')              // Normalizar espacios múltiples
            .trim();
        };
        
        const cleanTitle = normalizeText(title);
        const cleanAuthor = normalizeText(author);
        
        // Intentar con título y autor exactos primero
        query = `intitle:"${cleanTitle}" inauthor:"${cleanAuthor}"`;
        
        console.log(`[fetchGoogleBooksData] Query: ${query}`);
      }
      const keyParam = GOOGLE_BOOKS_API_KEY ? `&key=${GOOGLE_BOOKS_API_KEY}` : '';
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&printType=books${keyParam}`;
      
      const resp = await axios.get(url, { timeout: 5000 });
      const item = resp.data?.items?.[0];
      
      if (item?.volumeInfo) {
        const vol = item.volumeInfo;
        console.log(`[fetchGoogleBooksData] ✅ Encontrado: ${vol.title} (${vol.imageLinks?.thumbnail ? 'con portada' : 'sin portada'})`);
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
      
      // Si no encuentra nada con búsqueda exacta, intentar búsqueda más flexible
      if (!isbn && retries === 0) {
        const flexibleTitle = title.split(' ').slice(0, 4).join(' '); // Primeras 4 palabras (era 3)
        const flexibleAuthor = author.split(' ')[0]; // Solo primer apellido
        const flexibleQuery = `intitle:${flexibleTitle} inauthor:${flexibleAuthor}`;
        console.log(`[fetchGoogleBooksData] Reintentando con query flexible: ${flexibleQuery}`);
        
        const flexUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(flexibleQuery)}&maxResults=5&printType=books${keyParam}`;
        const flexResp = await axios.get(flexUrl, { timeout: 5000 });
        const items = flexResp.data?.items || [];
        
        // Buscar el mejor match por similitud de título
        for (const candidate of items) {
          const candTitle = (candidate.volumeInfo?.title || '').toLowerCase();
          const candAuthor = (candidate.volumeInfo?.authors?.[0] || '').toLowerCase();
          const searchTitle = title.toLowerCase();
          const searchAuthor = author.toLowerCase();
          
          // Match flexible: título contiene o autor coincide
          if (candTitle.includes(searchTitle.substring(0, 15)) || searchTitle.includes(candTitle.substring(0, 15)) || candAuthor.includes(searchAuthor.split(' ')[0])) {
            const vol = candidate.volumeInfo;
            console.log(`[fetchGoogleBooksData] ✅ Match flexible encontrado: ${vol.title}`);
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
        }
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
          book.coverUrl = googleBooksData.imageLinks?.thumbnail || googleBooksData.imageLinks?.smallThumbnail || book.coverUrl || null;
          book.description = googleBooksData.description || book.description || null;
          book.publisher = googleBooksData.publisher || book.publisher || null;
          book.publishedDate = googleBooksData.publishedDate || book.publishedDate || null;
          book.pageCount = googleBooksData.pageCount || book.pageCount || null;
          book.categories = googleBooksData.categories || book.categories || [];
          book.language = googleBooksData.language || book.language || null;
          book.averageRating = googleBooksData.averageRating !== undefined ? googleBooksData.averageRating : (book.averageRating || null);
          book.ratingsCount = googleBooksData.ratingsCount || book.ratingsCount || 0;
          book.previewLink = googleBooksData.previewLink || book.previewLink || null;
          book.imageLinks = googleBooksData.imageLinks || book.imageLinks || null;
          
          // Guardar cambios en JSON
          await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
          console.log(`[SYNC-GBOOKS] ✅ Datos guardados: ${book.title}`);
          updated++;
        }
      } catch (err) {
        console.warn(`[SYNC-GBOOKS] Error sincronizando ${book.title}:`, err.message);
      }
    }

    // Eliminar duplicados antes de guardar
    const beforeCount = bookMetadata.length;
    bookMetadata = removeDuplicateBooks(bookMetadata);
    const duplicatesRemoved = beforeCount - bookMetadata.length;

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
    id: book.id,
    uploadDate: book.uploadDate,
    createdTime: book.createdTime
  };
  
  // Obtener datos actualizados de Google Books ANTES de guardar
  try {
    console.log(`[API /books/:id PUT] Fetching Google Books data for: ${validated.title} by ${validated.author}`);
    const googleBooksData = await fetchGoogleBooksData(validated.title, validated.author);
    
    if (googleBooksData) {
      console.log(`[API /books/:id PUT] ✅ Datos recibidos de Google Books:`, {
        title: googleBooksData.title,
        hasCover: !!googleBooksData.imageLinks?.thumbnail,
        hasDescription: !!googleBooksData.description,
        hasPublisher: !!googleBooksData.publisher
      });
      
      // Merge datos de Google Books (solo campos vacíos)
      const merged = mergeGoogleDataIntoBook(validated, googleBooksData);
      
      // Actualizar portada si no tiene una válida
      const imageUrl = googleBooksData.imageLinks?.thumbnail || googleBooksData.imageLinks?.smallThumbnail || null;
      const hasLocalCover = validated.coverUrl && validated.coverUrl.startsWith('/cover');
      const hasNoCover = !validated.coverUrl || validated.coverUrl.trim() === '';
      
      if (imageUrl && (hasNoCover || hasLocalCover)) {
        validated.coverUrl = imageUrl;
        validated.imageLinks = googleBooksData.imageLinks || validated.imageLinks;
        console.log(`[API /books/:id PUT] ✅ Portada actualizada: ${imageUrl}`);
      }
      
      console.log(`[API /books/:id PUT] ✅ Google Books data merged - Cover: ${validated.coverUrl ? '✅' : '❌'}, Description: ${validated.description ? '✅' : '❌'}`);
    } else {
      console.log(`[API /books/:id PUT] ⚠️ No se encontraron datos en Google Books para "${validated.title}"`);
      
      // Si no hay portada y Google Books no encontró nada, asignar fallback
      if (!validated.coverUrl || validated.coverUrl.startsWith('/cover')) {
        const fallback = getRandomCoverImage();
        if (fallback) {
          validated.coverUrl = fallback;
          console.log(`[API /books/:id PUT] 🎲 Fallback asignado: ${fallback}`);
        }
      }
    }
  } catch (err) {
    console.error(`[API /books/:id PUT] Error fetching Google Books data:`, err.message);
  }
  
  // Actualizar en memoria DESPUÉS de enriquecer con Google Books
  bookMetadata[bookIndex] = validated;
  
  // Guardar a disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`[API /books/:id PUT] ✅ Libro guardado: ${validated.title} (ID: ${id})`);
    console.log(`[API /books/:id PUT] 📊 Estado final - Cover: ${validated.coverUrl}, Description length: ${validated.description?.length || 0}`);
    res.json({ success: true, book: validated });
  } catch (err) {
    console.error('[API /books/:id PUT] Error al guardar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Sincronizar desde carpeta local a Google Drive
app.post('/api/sync-folder-to-drive', upload.single('epubFile'), async (req, res) => {
  try {
    const pass = req.body.pass || '';
    if (pass !== '252914') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    // Verificar que el archivo sea un EPUB
    if (!file.originalname.toLowerCase().endsWith('.epub')) {
      return res.status(400).json({ error: 'El archivo debe ser un EPUB' });
    }

    // Leer el archivo como buffer
    const fileBuffer = file.buffer;

    // Subir a Google Drive
    if (!driveUpload) {
      throw new Error('Google Drive no está inicializado para subida');
    }

    // Crear archivo en Google Drive
    const fileMetadata = {
      name: file.originalname,
      mimeType: 'application/epub+zip',
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/epub+zip',
      body: bufferToStream(fileBuffer)
    };

    const driveResponse = await driveUpload.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    const fileId = driveResponse.data.id;
    console.log(`✅ Archivo subido a Drive con ID: ${fileId}`);

    // Guardar metadata básica en books.json
    const newBook = {
      id: fileId,
      title: file.originalname.replace('.epub', ''),
      author: 'Desconocido',
      uploadDate: new Date().toISOString(),
      createdTime: new Date().toISOString(),
      coverUrl: null,
      description: null,
      publisher: null,
      publishedDate: null,
      pageCount: null,
      categories: [],
      language: null,
      averageRating: null,
      ratingsCount: 0,
      previewLink: null,
      imageLinks: null
    };

    // Agregar a metadata existente
    bookMetadata.push(newBook);
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));

    res.json({ success: true, id: fileId });
  } catch (err) {
    console.error('Error en sincronización de carpeta a Drive:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Forzar actualización de metadata desde Google Books
app.post('/api/force-update-metadata', async (req, res) => {
  try {
    const pass = req.body.pass || '';
    if (pass !== '252914') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    reloadBooksMetadata();
    
    let updatedCount = 0;
    for (const book of bookMetadata) {
      try {
        const googleBooksData = await fetchGoogleBooksData(book.title, book.author);
        if (googleBooksData) {
          const merged = mergeGoogleDataIntoBook(book, googleBooksData);
          if (merged) {
            updatedCount++;
            console.log(`✅ Metadata actualizada para: ${book.title}`);
          }
        }
      } catch (err) {
        console.warn(`Error actualizando metadata para ${book.title}:`, err.message);
      }
    }

    // Guardar cambios
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`✅ Sincronización completa. ${updatedCount} libros actualizados.`);

    res.json({ 
      success: true, 
      message: `Sincronización completada. ${updatedCount} libros actualizados.`,
      updated: updatedCount
    });
  } catch (err) {
    console.error('Error en la sincronización forzada:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Sincronizar todos los libros desde Drive
app.get('/api/sync-all-drive', async (req, res) => {
  try {
    const pass = req.query.pass || '';
    if (pass !== '252914') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!driveRead) {
      throw new Error('Google Drive no está inicializado para lectura');
    }

    // Listar todos los archivos en la carpeta de Drive
    const files = await listAllFiles(folderId);
    console.log(`Encontrados ${files.length} archivos en Google Drive`);

    // Filtrar solo los EPUB
    const epubFiles = files.filter(f => f.name.toLowerCase().endsWith('.epub'));
    console.log(`Se encontraron ${epubFiles.length} archivos EPUB`);

    // Sincronizar con la metadata existente
    const nuevosLibros = [];
    const librosActualizados = [];
    const librosDuplicados = [];
    
    for (const file of epubFiles) {
      const exists = bookMetadata.find(b => b.id === file.id);
      if (!exists) {
        // Nuevo libro
        const newBook = {
          id: file.id,
          title: file.name.replace('.epub', ''),
          author: 'Desconocido',
          uploadDate: new Date().toISOString(),
          createdTime: new Date().toISOString(),
          coverUrl: null,
          description: null,
          publisher: null,
          publishedDate: null,
          pageCount: null,
          categories: [],
          language: null,
          averageRating: null,
          ratingsCount: 0,
          previewLink: null,
          imageLinks: null
        };
        nuevosLibros.push(newBook);
      } else {
        // Libro existente, verificar si necesita actualización
        const book = exists;
        const googleData = await fetchGoogleBooksData(book.title, book.author);
        if (googleData) {
          const updated = mergeGoogleDataIntoBook(book, googleData);
          if (updated) {
            librosActualizados.push(book);
          }
        }
      }
    }

    // Guardar todos los nuevos libros
    if (nuevosLibros.length > 0) {
      bookMetadata = [...bookMetadata, ...nuevosLibros];
      await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
      console.log(`Se añadieron ${nuevosLibros.length} nuevos libros`);
    }

    // Actualizar solo los libros que cambiaron
    if (librosActualizados.length > 0) {
      await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
      console.log(`Se actualizaron ${librosActualizados.length} libros existentes`);
    }

    res.json({ 
      success: true, 
      nuevos: nuevosLibros.length, 
      actualizados: librosActualizados.length, 
      duplicados: librosDuplicados.length 
    });
  } catch (err) {
    console.error('Error en la sincronización desde Drive:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Eliminar libro
app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  
  reloadBooksMetadata();
  
  const bookIndex = bookMetadata.findIndex(b => b.id === id);
  if (bookIndex === -1) return res.status(404).json({ error: 'Libro no encontrado' });
  
  // Eliminar de Google Drive
  try {
    if (driveUpload) {
      await driveUpload.files.delete({ fileId: id });
      console.log(`✅ Archivo ${id} eliminado de Google Drive`);
    } else {
      console.warn(`⚠️ No se pudo eliminar el archivo ${id} de Google Drive: no está inicializado el cliente de subida`);
    }
  } catch (err) {
    console.error(`Error eliminando archivo de Google Drive:`, err.message);
  }
  
  // Eliminar de metadata
  bookMetadata.splice(bookIndex, 1);
  
  // Guardar cambios en disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`✅ Libro ${id} eliminado de la metadata y cambios guardados`);
    res.json({ success: true, message: 'Libro eliminado' });
  } catch (err) {
    console.error('Error al guardar cambios en disco:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Obtener estadísticas simples
app.get('/api/stats', (req, res) => {
  const totalLibros = bookMetadata.length;
  const totalDescargas = downloadCount;
  const totalUploads = uploadCount;
  
  res.json({ 
    success: true, 
    stats: {
      totalLibros,
      totalDescargas,
      totalUploads
    } 
  });
});

// API: Obtener listado de libros
app.get('/api/books', (req, res) => {
  // Solo devolver campos básicos por ahora
  const librosBasicos = bookMetadata.map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverUrl: b.coverUrl,
    description: b.description,
    publisher: b.publisher,
    publishedDate: b.publishedDate,
    pageCount: b.pageCount,
    categories: b.categories,
    language: b.language,
    averageRating: b.averageRating,
    ratingsCount: b.ratingsCount,
    previewLink: b.previewLink
  }));
  
  res.json({ success: true, books: librosBasicos });
});

// API: Obtener libro por ID
app.get('/api/books/:id', (req, res) => {
  const { id } = req.params;
  
  const book = bookMetadata.find(b => b.id === id);
  if (!book) {
    return res.status(404).json({ error: 'Libro no encontrado' });
  }
  
  res.json({ success: true, book });
});

// API: Subir archivo EPUB
app.post('/api/upload', upload.single('epubFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    // Verificar que el archivo sea un EPUB
    if (!file.originalname.toLowerCase().endsWith('.epub')) {
      return res.status(400).json({ error: 'El archivo debe ser un EPUB' });
    }

    // Leer el archivo como buffer
    const fileBuffer = file.buffer;

    // Subir a Google Drive
    if (!driveUpload) {
      throw new Error('Google Drive no está inicializado para subida');
    }

    // Crear archivo en Google Drive
    const fileMetadata = {
      name: file.originalname,
      mimeType: 'application/epub+zip',
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/epub+zip',
      body: bufferToStream(fileBuffer)
    };

    const driveResponse = await driveUpload.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    const fileId = driveResponse.data.id;
    console.log(`✅ Archivo subido a Drive con ID: ${fileId}`);

    // Guardar metadata básica en books.json
    const newBook = {
      id: fileId,
      title: file.originalname.replace('.epub', ''),
      author: 'Desconocido',
      uploadDate: new Date().toISOString(),
      createdTime: new Date().toISOString(),
      coverUrl: null,
      description: null,
      publisher: null,
      publishedDate: null,
      pageCount: null,
      categories: [],
      language: null,
      averageRating: null,
      ratingsCount: 0,
      previewLink: null,
      imageLinks: null
    };

    // Agregar a metadata existente
    bookMetadata.push(newBook);
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));

    res.json({ success: true, id: fileId });
  } catch (err) {
    console.error('Error en la subida de archivo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Obtener libro por ID (detailed)
app.get('/api/books/detail/:id', async (req, res) => {
  const { id } = req.params;
  
  const book = bookMetadata.find(b => b.id === id);
  if (!book) {
    return res.status(404).json({ error: 'Libro no encontrado' });
  }
  
  // Intentar obtener datos adicionales de Google Books si faltan
  let googleBooksData = null;
  if (!book.description || !book.publisher || !book.pageCount || !book.categories || book.categories.length === 0) {
    try {
      googleBooksData = await fetchGoogleBooksData(book.title, book.author);
      if (googleBooksData) {
        mergeGoogleDataIntoBook(book, googleBooksData);
        console.log(`Datos de Google Books añadidos para: ${book.title}`);
      }
    } catch (err) {
      console.warn(`Error obteniendo datos de Google Books para ${book.title}:`, err.message);
    }
  }
  
  res.json({ success: true, book, googleBooksData });
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
    id: book.id,
    uploadDate: book.uploadDate,
    createdTime: book.createdTime
  };
  
  // Obtener datos actualizados de Google Books ANTES de guardar
  try {
    console.log(`[API /books/:id PUT] Fetching Google Books data for: ${validated.title} by ${validated.author}`);
    const googleBooksData = await fetchGoogleBooksData(validated.title, validated.author);
    
    if (googleBooksData) {
      console.log(`[API /books/:id PUT] ✅ Datos recibidos de Google Books:`, {
        title: googleBooksData.title,
        hasCover: !!googleBooksData.imageLinks?.thumbnail,
        hasDescription: !!googleBooksData.description,
        hasPublisher: !!googleBooksData.publisher
      });
      
      // Merge datos de Google Books (solo campos vacíos)
      const merged = mergeGoogleDataIntoBook(validated, googleBooksData);
      
      // Actualizar portada si no tiene una válida
      const imageUrl = googleBooksData.imageLinks?.thumbnail || googleBooksData.imageLinks?.smallThumbnail || null;
      const hasLocalCover = validated.coverUrl && validated.coverUrl.startsWith('/cover');
      const hasNoCover = !validated.coverUrl || validated.coverUrl.trim() === '';
      
      if (imageUrl && (hasNoCover || hasLocalCover)) {
        validated.coverUrl = imageUrl;
        validated.imageLinks = googleBooksData.imageLinks || validated.imageLinks;
        console.log(`[API /books/:id PUT] ✅ Portada actualizada: ${imageUrl}`);
      }
      
      console.log(`[API /books/:id PUT] ✅ Google Books data merged - Cover: ${validated.coverUrl ? '✅' : '❌'}, Description: ${validated.description ? '✅' : '❌'}`);
    } else {
      console.log(`[API /books/:id PUT] ⚠️ No se encontraron datos en Google Books para "${validated.title}"`);
      
      // Si no hay portada y Google Books no encontró nada, asignar fallback
      if (!validated.coverUrl || validated.coverUrl.startsWith('/cover')) {
        const fallback = getRandomCoverImage();
        if (fallback) {
          validated.coverUrl = fallback;
          console.log(`[API /books/:id PUT] 🎲 Fallback asignado: ${fallback}`);
        }
      }
    }
  } catch (err) {
    console.error(`[API /books/:id PUT] Error fetching Google Books data:`, err.message);
  }
  
  // Actualizar en memoria DESPUÉS de enriquecer con Google Books
  bookMetadata[bookIndex] = validated;
  
  // Guardar a disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`[API /books/:id PUT] ✅ Libro guardado: ${validated.title} (ID: ${id})`);
    console.log(`[API /books/:id PUT] 📊 Estado final - Cover: ${validated.coverUrl}, Description length: ${validated.description?.length || 0}`);
    res.json({ success: true, book: validated });
  } catch (err) {
    console.error('[API /books/:id PUT] Error al guardar:', err.message);
    res.status(500).json({ error: err.message });
  }
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
          book.coverUrl = googleBooksData.imageLinks?.thumbnail || googleBooksData.imageLinks?.smallThumbnail || book.coverUrl || null;
          book.description = googleBooksData.description || book.description || null;
          book.publisher = googleBooksData.publisher || book.publisher || null;
          book.publishedDate = googleBooksData.publishedDate || book.publishedDate || null;
          book.pageCount = googleBooksData.pageCount || book.pageCount || null;
          book.categories = googleBooksData.categories || book.categories || [];
          book.language = googleBooksData.language || book.language || null;
          book.averageRating = googleBooksData.averageRating !== undefined ? googleBooksData.averageRating : (book.averageRating || null);
          book.ratingsCount = googleBooksData.ratingsCount || book.ratingsCount || 0;
          book.previewLink = googleBooksData.previewLink || book.previewLink || null;
          book.imageLinks = googleBooksData.imageLinks || book.imageLinks || null;
          
          // Guardar cambios en JSON
          await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
          console.log(`[SYNC-GBOOKS] ✅ Datos guardados: ${book.title}`);
          updated++;
        }
      } catch (err) {
        console.warn(`[SYNC-GBOOKS] Error sincronizando ${book.title}:`, err.message);
      }
    }

    // Eliminar duplicados antes de guardar
    const beforeCount = bookMetadata.length;
    bookMetadata = removeDuplicateBooks(bookMetadata);
    const duplicatesRemoved = beforeCount - bookMetadata.length;

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

// API: Eliminar libro
app.delete('/api/books/:id', async (req, res) => {
  const { id } = req.params;
  
  reloadBooksMetadata();
  
  const bookIndex = bookMetadata.findIndex(b => b.id === id);
  if (bookIndex === -1) return res.status(404).json({ error: 'Libro no encontrado' });
  
  // Eliminar de Google Drive
  try {
    if (driveUpload) {
      await driveUpload.files.delete({ fileId: id });
      console.log(`✅ Archivo ${id} eliminado de Google Drive`);
    } else {
      console.warn(`⚠️ No se pudo eliminar el archivo ${id} de Google Drive: no está inicializado el cliente de subida`);
    }
  } catch (err) {
    console.error(`Error eliminando archivo de Google Drive:`, err.message);
  }
  
  // Eliminar de metadata
  bookMetadata.splice(bookIndex, 1);
  
  // Guardar cambios en disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`✅ Libro ${id} eliminado de la metadata y cambios guardados`);
    res.json({ success: true, message: 'Libro eliminado' });
  } catch (err) {
    console.error('Error al guardar cambios en disco:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Obtener estadísticas simples
app.get('/api/stats', (req, res) => {
  const totalLibros = bookMetadata.length;
  const totalDescargas = downloadCount;
  const totalUploads = uploadCount;
  
  res.json({ 
    success: true, 
    stats: {
      totalLibros,
      totalDescargas,
      totalUploads
    } 
  });
});

// API: Obtener listado de libros
app.get('/api/books', (req, res) => {
  // Solo devolver campos básicos por ahora
  const librosBasicos = bookMetadata.map(b => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverUrl: b.coverUrl,
    description: b.description,
    publisher: b.publisher,
    publishedDate: b.publishedDate,
    pageCount: b.pageCount,
    categories: b.categories,
    language: b.language,
    averageRating: b.averageRating,
    ratingsCount: b.ratingsCount,
    previewLink: b.previewLink
  }));
  
  res.json({ success: true, books: librosBasicos });
});

// API: Obtener libro por ID
app.get('/api/books/:id', (req, res) => {
  const { id } = req.params;
  
  const book = bookMetadata.find(b => b.id === id);
  if (!book) {
    return res.status(404).json({ error: 'Libro no encontrado' });
  }
  
  res.json({ success: true, book });
});

// API: Subir archivo EPUB
app.post('/api/upload', upload.single('epubFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    // Verificar que el archivo sea un EPUB
    if (!file.originalname.toLowerCase().endsWith('.epub')) {
      return res.status(400).json({ error: 'El archivo debe ser un EPUB' });
    }

    // Leer el archivo como buffer
    const fileBuffer = file.buffer;

    // Subir a Google Drive
    if (!driveUpload) {
      throw new Error('Google Drive no está inicializado para subida');
    }

    // Crear archivo en Google Drive
    const fileMetadata = {
      name: file.originalname,
      mimeType: 'application/epub+zip',
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/epub+zip',
      body: bufferToStream(fileBuffer)
    };

    const driveResponse = await driveUpload.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    const fileId = driveResponse.data.id;
    console.log(`✅ Archivo subido a Drive con ID: ${fileId}`);

    // Guardar metadata básica en books.json
    const newBook = {
      id: fileId,
      title: file.originalname.replace('.epub', ''),
      author: 'Desconocido',
      uploadDate: new Date().toISOString(),
      createdTime: new Date().toISOString(),
      coverUrl: null,
      description: null,
      publisher: null,
      publishedDate: null,
      pageCount: null,
      categories: [],
      language: null,
      averageRating: null,
      ratingsCount: 0,
      previewLink: null,
      imageLinks: null
    };

    // Agregar a metadata existente
    bookMetadata.push(newBook);
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));

    res.json({ success: true, id: fileId });
  } catch (err) {
    console.error('Error en la subida de archivo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: Obtener libro por ID (detailed)
app.get('/api/books/detail/:id', async (req, res) => {
  const { id } = req.params;
  
  const book = bookMetadata.find(b => b.id === id);
  if (!book) {
    return res.status(404).json({ error: 'Libro no encontrado' });
  }
  
  // Intentar obtener datos adicionales de Google Books si faltan
  let googleBooksData = null;
  if (!book.description || !book.publisher || !book.pageCount || !book.categories || book.categories.length === 0) {
    try {
      googleBooksData = await fetchGoogleBooksData(book.title, book.author);
      if (googleBooksData) {
        mergeGoogleDataIntoBook(book, googleBooksData);
        console.log(`Datos de Google Books añadidos para: ${book.title}`);
      }
    } catch (err) {
      console.warn(`Error obteniendo datos de Google Books para ${book.title}:`, err.message);
    }
  }
  
  res.json({ success: true, book, googleBooksData });
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
    id: book.id,
    uploadDate: book.uploadDate,
    createdTime: book.createdTime
  };
  
  // Obtener datos actualizados de Google Books ANTES de guardar
  try {
    console.log(`[API /books/:id PUT] Fetching Google Books data for: ${validated.title} by ${validated.author}`);
    const googleBooksData = await fetchGoogleBooksData(validated.title, validated.author);
    
    if (googleBooksData) {
      console.log(`[API /books/:id PUT] ✅ Datos recibidos de Google Books:`, {
        title: googleBooksData.title,
        hasCover: !!googleBooksData.imageLinks?.thumbnail,
        hasDescription: !!googleBooksData.description,
        hasPublisher: !!googleBooksData.publisher
      });
      
      // Merge datos de Google Books (solo campos vacíos)
      const merged = mergeGoogleDataIntoBook(validated, googleBooksData);
      
      // Actualizar portada si no tiene una válida
      const imageUrl = googleBooksData.imageLinks?.thumbnail || googleBooksData.imageLinks?.smallThumbnail || null;
      const hasLocalCover = validated.coverUrl && validated.coverUrl.startsWith('/cover');
      const hasNoCover = !validated.coverUrl || validated.coverUrl.trim() === '';
      
      if (imageUrl && (hasNoCover || hasLocalCover)) {
        validated.coverUrl = imageUrl;
        validated.imageLinks = googleBooksData.imageLinks || validated.imageLinks;
        console.log(`[API /books/:id PUT] ✅ Portada actualizada: ${imageUrl}`);
      }
      
      console.log(`[API /books/:id PUT] ✅ Google Books data merged - Cover: ${validated.coverUrl ? '✅' : '❌'}, Description: ${validated.description ? '✅' : '❌'}`);
    } else {
      console.log(`[API /books/:id PUT] ⚠️ No se encontraron datos en Google Books para "${validated.title}"`);
      
      // Si no hay portada y Google Books no encontró nada, asignar fallback
      if (!validated.coverUrl || validated.coverUrl.startsWith('/cover')) {
        const fallback = getRandomCoverImage();
        if (fallback) {
          validated.coverUrl = fallback;
          console.log(`[API /books/:id PUT] 🎲 Fallback asignado: ${fallback}`);
        }
      }
    }
  } catch (err) {
    console.error(`[API /books/:id PUT] Error fetching Google Books data:`, err.message);
  }
  
  // Actualizar en memoria DESPUÉS de enriquecer con Google Books
  bookMetadata[bookIndex] = validated;
  
  // Guardar a disco
  try {
    await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
    console.log(`[API /books/:id PUT] ✅ Libro guardado: ${validated.title} (ID: ${id})`);
    console.log(`[API /books/:id PUT] 📊 Estado final - Cover: ${validated.coverUrl}, Description length: ${validated.description?.length || 0}`);
    res.json({ success: true, book: validated });
  } catch (err) {
    console.error('[API /books/:id PUT] Error al guardar:', err.message);
    res.status(500).json({ error: err.message });
  }
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
          book.coverUrl = googleBooksData.imageLinks?.thumbnail || googleBooksData.imageLinks?.smallThumbnail || book.coverUrl || null;
          book.description = googleBooksData.description || book.description || null;
          book.publisher = googleBooksData.publisher || book.publisher || null;
          book.publishedDate = googleBooksData.publishedDate || book.publishedDate || null;
          book.pageCount = googleBooksData.pageCount || book.pageCount || null;
          book.categories = googleBooksData.categories || book.categories || [];
          book.language = googleBooksData.language || book.language || null;
          book.averageRating = googleBooksData.averageRating !== undefined ? googleBooksData.averageRating : (book.averageRating || null);
          book.ratingsCount = googleBooksData.ratingsCount || book.ratingsCount || 0;
          book.previewLink = googleBooksData.previewLink || book.previewLink || null;
          book.imageLinks = googleBooksData.imageLinks || book.imageLinks || null;
          
          // Guardar cambios en JSON
          await fs.promises.writeFile(BOOKS_FILE, JSON.stringify(bookMetadata, null, 2));
          console.log(`[SYNC-GBOOKS] ✅ Datos guardados: ${book.title}`);
          updated++;
        }
      } catch (err) {
        console.warn(`[SYNC-GBOOKS] Error sincronizando ${book.title}:`, err.message);
      }
    }

    // Eliminar duplicados antes de guardar
    const beforeCount = bookMetadata.length;
    bookMetadata = removeDuplicateBooks(bookMetadata);
    const duplicatesRemoved = beforeCount - bookMetadata.length;

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
// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`📚 BiblioKobo activo en http://localhost:${PORT}`);
});
