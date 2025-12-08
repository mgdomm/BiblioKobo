const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

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

#grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:30px; padding:30px 20px 40px 20px; max-width:100%; margin:0 auto; }
.book { display:inline-block; vertical-align:top; width:110px; min-height:160px; background:rgba(17,17,17,0.9); padding:6px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); margin:4px; text-align:center; word-wrap:break-word; transition:opacity 0.3s, transform 0.2s; }
.book img { width:80px; height:120px; border-radius:5px; object-fit:cover; margin-bottom:4px; }
.title { font-size:12px; font-weight:700; color:#eee; font-family:'MedievalSharp', cursive; margin-bottom:2px; }
.author-span a, .number-span a { color:#fff; text-decoration:none; font-family:'MedievalSharp', cursive; font-size:12px; font-weight:400; }
.author-span, .number-span { font-size:12px; color:#fff; font-family:'MedievalSharp', cursive; font-weight:400; }
.book { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; vertical-align:top; width:100%; min-height:auto; background:linear-gradient(180deg, rgba(18,18,18,0.92), rgba(12,12,12,0.9)); padding:8px; border-radius:10px; border:1px solid rgba(255,255,255,0.04); text-align:center; word-wrap:break-word; transition:opacity 0.3s, transform 0.15s; box-shadow:0 6px 18px rgba(0,0,0,0.6); }
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

// Ratings vía Goodreads (auto_complete) con fallback a Open Library
async function fetchRating(title, author, isbn = null) {
  const key = `${(title||'').toLowerCase()}|${(author||'').toLowerCase()}|${isbn||''}`;
  if (ratingsCache.has(key)) return ratingsCache.get(key);

  const normalize = (str = '') => str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const titleNorm = normalize(title);
  const authorNorm = normalize(author);

  // Preferir búsqueda directa por ISBN cuando esté disponible
  if (isbn) {
    const isbnRating = await fetchGoodreadsByIsbn(isbn);
    if (isbnRating) {
      setRatingCache(key, isbnRating);
      return isbnRating;
    }
  }

  try {
    const query = [title, author].filter(Boolean).join(' ');
    const url = `https://www.goodreads.com/book/auto_complete?format=json&q=${encodeURIComponent(query)}`;
    const resp = await axios.get(url, { timeout: 7000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const items = Array.isArray(resp.data) ? resp.data.slice(0, 25) : [];

    let bestRating = 0;
    let bestCandidate = null;
    for (const item of items) {
      const itemTitle = normalize(item.title || item.bookTitle || item.bookTitleBare || '');
      const itemAuthor = normalize(item.author?.name || item.authorName || item.author || '');
      const rating = Number(item.average_rating || item.avg_rating || 0) || 0;
      const votes = Number(item.ratings_count || item.ratingsCount || item.work_ratings_count || item.ratings || 0) || 0;
      // descartar valores dudosos (sin votos, rating fuera de rango, o 5.0 sin respaldo)
      if (!rating || rating > 5 || votes < 1) continue;
      if (rating >= 4.99 && votes < 500) continue;

      const titleMatch = titleNorm && itemTitle ? (itemTitle === titleNorm || itemTitle.includes(titleNorm) || titleNorm.includes(itemTitle)) : false;
      const authorMatch = authorNorm && itemAuthor ? (itemAuthor === authorNorm || itemAuthor.includes(authorNorm) || authorNorm.includes(itemAuthor)) : false;

      // Requerimos coincidencia de título; autor opcional si hay muchos votos
      if (!titleMatch) continue;
      if (!authorMatch && votes < 50) continue;

      if (rating > bestRating) {
        bestRating = rating;
        bestCandidate = item;
        if (bestRating >= 4.8 && votes >= 1000) break; // suficientemente confiable
      }
    }

    // Si tenemos un candidato, intentar extraer rating real desde la página de Goodreads
    if (bestCandidate) {
      const pageId = bestCandidate.id || bestCandidate.bookId || bestCandidate.workId || bestCandidate.bookIdV2;
      if (pageId) {
        const pageRating = await fetchGoodreadsPageRating(pageId);
        if (pageRating) {
          setRatingCache(key, pageRating);
          return pageRating;
        }
      }
      // fallback: usar el rating del autocomplete si no pudimos parsear página
      if (bestRating) {
        setRatingCache(key, bestRating);
        return bestRating;
      }
    }
  } catch (err) {
    // Ignorar y caer al fallback
  }

  // Intentar con búsqueda HTML si autocomplete no dio rating válido
  try {
    const searchRating = await fetchGoodreadsSearchRating(title, author);
    if (searchRating) {
      setRatingCache(key, searchRating);
      return searchRating;
    }
  } catch (err) {
    // ignorar
  }

  // Fallback Open Library si Goodreads no devuelve rating
  const fallback = await fetchRatingOpenLibrary(title, author);
  setRatingCache(key, fallback);
  return fallback;
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

async function fetchGoodreadsPageRating(pageId) {
  try {
    const pageUrl = `https://www.goodreads.com/book/show/${pageId}`;
    const html = await axios.get(pageUrl, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.data || '');
    // Buscar itemprop ratingValue
    let match = /itemprop="ratingValue"[^>]*>\s*([0-9.,]+)/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num && num > 0 && num <= 5) return num;
    }
    // Buscar "average_rating":"4.00"
    match = /"average_rating"\s*:\s*"([0-9.]+)"/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) return num;
    }
    // Buscar "avgRating":4.00
    match = /"avgRating"\s*:\s*([0-9.]+)/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) return num;
    }
  } catch (err) {
    // ignorar
  }
  return 0;
}

async function fetchGoodreadsSearchRating(title, author) {
  const query = [title, author].filter(Boolean).join(' ');
  if (!query) return 0;
  try {
    const url = `https://www.goodreads.com/search?q=${encodeURIComponent(query)}`;
    const html = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.data || '');
    const anchors = Array.from(html.matchAll(/<a[^>]+class="bookTitle"[^>]+href="\/book\/show\/([^"?#]+)[^\"]*"[^>]*>([\s\S]*?)<\/a>/gi));
    const normTitle = (title||'').toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g,'').trim();
    let bestId = null;
    let bestScore = -1;
    anchors.forEach(m => {
      const id = (m[1]||'').split('?')[0];
      const text = (m[2]||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
      const t = text.toLowerCase().normalize('NFD').replace(/[^a-z0-9\s]/g,'').trim();
      if (!t) return;
      const titleMatch = normTitle && t ? (t.includes(normTitle) || normTitle.includes(t)) : false;
      const score = titleMatch ? t.length / Math.max(normTitle.length, 1) : 0;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    });

    if (bestId) {
      const pageRating = await fetchGoodreadsPageRating(bestId);
      if (pageRating) return pageRating;
    }

    // Último intento: primer aria-label global
    const match = /aria-label="\s*([0-9.,]+)\s+average rating\s*"/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num && num > 0 && num <= 5) return num;
    }
  } catch (err) {
    // ignorar
  }
  return 0;
}

async function fetchGoodreadsByIsbn(isbn) {
  if (!isbn) return 0;
  try {
    const url = `https://www.goodreads.com/search?q=${encodeURIComponent(isbn)}`;
    const html = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.data || '');
    // Buscar directamente en la página de resultados por ISBN
    let match = /aria-label="\s*([0-9.,]+)\s+average rating\s*"/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num && num > 0 && num <= 5) return num;
    }
    match = /"average_rating"\s*:\s*"([0-9.]+)"/i.exec(html);
    if (match && match[1]) {
      const num = parseFloat(match[1]);
      if (num && num > 0 && num <= 5) return num;
    }
  } catch (err) {
    // ignorar
  }
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
  let booksHtml = libros.map(book => {
    const cover = getCoverForBook(book.id);
    const imgHtml = cover ? `<img src="${cover}" />` : `<div style="width:80px;height:120px;background:#333;border-radius:5px;"></div>`;
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
  </form>
  <div id="grid">${booksHtml}</div>
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
  
  <!-- Botón flotante de stats -->
  <button id="stats-btn" style="position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;background:transparent;border:2px solid #19E6D6;cursor:pointer;z-index:100;display:flex;align-items:center;justify-content:center;transition:0.25s;padding:0;color:#19E6D6;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2l-8 12h7l-7 8 12-14h-7l3-6z"></path>
    </svg>
  </button>
  
  <!-- Modal de login para stats -->
  <div id="login-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;justify-content:center;align-items:center;">
    <div style="background:linear-gradient(135deg, rgba(18,18,18,0.95), rgba(12,12,12,0.9));border:2px solid rgba(25,230,214,0.5);border-radius:12px;padding:40px;text-align:center;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.8);">
      <h2 style="font-family:'MedievalSharp', cursive;color:#19E6D6;font-size:24px;margin:0 0 20px 0;">🔒 Acceso a Stats</h2>
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
    const loginModal = document.getElementById('login-modal');
    const loginBtn = document.getElementById('login-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const passInput = document.getElementById('pass-input');
    const errorMessage = document.getElementById('error-message');
    
    statsBtn.addEventListener('click', () => {
      loginModal.style.display = 'flex';
      passInput.focus();
      errorMessage.style.display = 'none';
      passInput.value = '';
    });
    
    cancelBtn.addEventListener('click', () => {
      loginModal.style.display = 'none';
      passInput.value = '';
      errorMessage.style.display = 'none';
    });
    
    loginBtn.addEventListener('click', () => {
      if (passInput.value === '252914') {
        window.location.href = '/stats?pass=' + encodeURIComponent(passInput.value);
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
  </script>
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
    // Build an array of metadata-shaped objects for rendering - SOLO desde JSON
    const librosForRender = files.map(f => {
      const meta = bookMetadata.find(b => b.id === f.id);
      if (meta) return { ...meta, id: f.id };
      // Si no está en JSON, algo falló
      console.warn(`[WARN] Libro ${f.id} no encontrado en JSON`);
      return null;
    }).filter(x => x);

    res.send(renderBookPage({libros:librosForRender,titlePage:'Libros',tipo:'libros',nombre:'libros',req,noResultsHtml:getRandomNoResultHtml()}));
  } catch(err){console.error(err); res.send('<p>Error al cargar libros.</p>');}
});

// Autores
app.get('/autores', (req,res)=>{
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
        const meta = await drive.files.get({ fileId: id, fields: 'name' });
        const filename = (meta.data && meta.data.name) ? meta.data.name : `file-${id}`;
        const stream = await drive.files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
        
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

  // Top 5 por rating (Goodreads)
  const librosParaRating = bookMetadata.filter(b => b && b.title && b.author);
  const results = [];
  const maxConcurrent = 8;
  let idx = 0;

  const worker = async () => {
    while (idx < librosParaRating.length) {
      const myIndex = idx++;
      const book = librosParaRating[myIndex];
      if (!book) continue;
      const rating = await fetchRating(book.title, book.author, book.isbn);
      results.push({ ...book, rating });
    }
  };

  await Promise.all(Array.from({ length: maxConcurrent }, worker));

  const topRatings = results
    .filter(r => r.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5);
  
  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Dashboard - Azkaban Reads</title><style>${css}</style></head>
<body>
  <div class="header-banner top" style="background-image:url('/cover/secuendarias/portada11.png');"></div>
  <div class="overlay top">
    <div class="top-buttons secondary"><a href="/">Inicio</a></div>
    <h1><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline; vertical-align:-8px; margin-right:2px;"><path d="M13 2l-8 12h7l-7 8 12-14h-7l3-6z"></path></svg>Dashboard</h1>
    <div class="top-buttons">
      <a href="/libros">Libros</a>
      <a href="/autores">Autores</a>
      <a href="/sagas">Sagas</a>
    </div>
  </div>
  
  <div style="padding:40px; max-width:1200px; margin:0 auto;">
    <!-- Estadísticas principales - más pequeñas -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-top:20px; margin-bottom:30px;">
      <div style="background:linear-gradient(135deg, rgba(25,230,214,0.1), rgba(25,230,214,0.05)); border:2px solid rgba(25,230,214,0.3); border-radius:12px; padding:15px; text-align:center;">
        <div style="width:32px; height:32px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <div style="font-size:11px; color:#aaa; margin-bottom:6px;">Libros</div>
        <div style="font-size:24px; color:#19E6D6; font-weight:bold; font-family:'MedievalSharp', cursive;">${totalLibros}</div>
      </div>
      
      <div style="background:linear-gradient(135deg, rgba(25,230,214,0.1), rgba(25,230,214,0.05)); border:2px solid rgba(25,230,214,0.3); border-radius:12px; padding:15px; text-align:center;">
        <div style="width:32px; height:32px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
        </div>
        <div style="font-size:11px; color:#aaa; margin-bottom:6px;">Autores</div>
        <div style="font-size:24px; color:#19E6D6; font-weight:bold; font-family:'MedievalSharp', cursive;">${totalAutores}</div>
      </div>
      
      <div style="background:linear-gradient(135deg, rgba(25,230,214,0.1), rgba(25,230,214,0.05)); border:2px solid rgba(25,230,214,0.3); border-radius:12px; padding:15px; text-align:center;">
        <div style="width:32px; height:32px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c1 1 2 2 4 2s3-1 4-2"/><path d="M9 5h6M6.5 5h11M2 12c0 2.5 1 4.5 3 5.5m16-1c2-1 3-3 3-5.5 0-5-4.5-9-9-9S3 7 3 12"/></svg>
        </div>
        <div style="font-size:11px; color:#aaa; margin-bottom:6px;">Sagas</div>
        <div style="font-size:24px; color:#19E6D6; font-weight:bold; font-family:'MedievalSharp', cursive;">${totalSagas}</div>
      </div>
      
      <div style="background:linear-gradient(135deg, rgba(25,230,214,0.1), rgba(25,230,214,0.05)); border:2px solid rgba(25,230,214,0.3); border-radius:12px; padding:15px; text-align:center;">
        <div style="width:32px; height:32px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><path d="M13 2l-8 12h7l-7 8 12-14h-7l3-6z"/></svg>
        </div>
        <div style="font-size:11px; color:#aaa; margin-bottom:6px;">Descargas</div>
        <div style="font-size:24px; color:#19E6D6; font-weight:bold; font-family:'MedievalSharp', cursive;">${downloadCount}</div>
      </div>
      
      <div style="background:linear-gradient(135deg, rgba(25,230,214,0.1), rgba(25,230,214,0.05)); border:2px solid rgba(25,230,214,0.3); border-radius:12px; padding:15px; text-align:center;">
        <div style="width:32px; height:32px; border:2px solid #19E6D6; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#19E6D6" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><polyline points="3 6 9 12 3 18"/></svg>
        </div>
        <div style="font-size:11px; color:#aaa; margin-bottom:6px;">Promedio</div>
        <div style="font-size:24px; color:#19E6D6; font-weight:bold; font-family:'MedievalSharp', cursive;">${promedioLibrosPorAutor}</div>
      </div>
    </div>
    
    <!-- Top 5 por rating (Goodreads) -->
    <div style="margin-top:20px; padding:30px; background:linear-gradient(135deg, rgba(25,25,25,0.95), rgba(18,18,18,0.9)); border:1px solid rgba(25,230,214,0.2); border-radius:12px;">
      <h3 style="font-family:'MedievalSharp', cursive; color:#19E6D6; margin:0 0 16px 0; font-size:20px;">Top 5 libros Goodreads</h3>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; min-width:480px;">
          <thead>
            <tr style="background:rgba(25,230,214,0.08);">
              <th style="text-align:left; padding:10px 8px; color:#19E6D6; font-family:'MedievalSharp', cursive;">#</th>
              <th style="text-align:left; padding:10px 8px; color:#19E6D6; font-family:'MedievalSharp', cursive;">Título</th>
              <th style="text-align:left; padding:10px 8px; color:#19E6D6; font-family:'MedievalSharp', cursive;">Autor</th>
              <th style="text-align:right; padding:10px 8px; color:#19E6D6; font-family:'MedievalSharp', cursive;">Rating</th>
            </tr>
          </thead>
          <tbody>
            ${topRatings.map((r, i) => `
              <tr style="border-bottom:1px solid rgba(25,230,214,0.1);">
                <td style="padding:10px 8px; color:#fff; font-family:'MedievalSharp', cursive;">${i + 1}</td>
                <td style="padding:10px 8px; color:#fff;">${r.title}</td>
                <td style="padding:10px 8px; color:#ccc;">${r.author}</td>
                <td style="padding:10px 8px; color:#19E6D6; text-align:right; font-weight:bold;">${r.rating.toFixed(2)}</td>
              </tr>
            `).join('') || `<tr><td colspan="4" style="padding:12px 8px; color:#999; text-align:center;">Sin ratings disponibles</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Top Autores -->
    <div style="margin-top:20px; padding:30px; background:linear-gradient(135deg, rgba(25,25,25,0.95), rgba(18,18,18,0.9)); border:1px solid rgba(25,230,214,0.2); border-radius:12px;">
      <h3 style="font-family:'MedievalSharp', cursive; color:#19E6D6; margin:0 0 20px 0; font-size:20px;">Top 5 Autores</h3>
      <div style="display:grid; gap:10px;">
        ${topAutores.map((a, i) => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; background:rgba(25,230,214,0.05); border-left:3px solid #19E6D6; border-radius:6px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:28px; height:28px; background:#19E6D6; color:#000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-family:'MedievalSharp', cursive;">${i + 1}</div>
              <span style="color:#fff; font-family:'MedievalSharp', cursive;">${a.name}</span>
            </div>
            <div style="color:#19E6D6; font-weight:bold; font-size:18px; font-family:'MedievalSharp', cursive;">${a.count}</div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Top Sagas -->
    <div style="margin-top:30px; padding:30px; background:linear-gradient(135deg, rgba(25,25,25,0.95), rgba(18,18,18,0.9)); border:1px solid rgba(25,230,214,0.2); border-radius:12px;">
      <h3 style="font-family:'MedievalSharp', cursive; color:#19E6D6; margin:0 0 20px 0; font-size:20px;">Top 5 Sagas</h3>
      <div style="display:grid; gap:10px;">
        ${topSagas.map((s, i) => `
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 15px; background:rgba(25,230,214,0.05); border-left:3px solid #19E6D6; border-radius:6px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:28px; height:28px; background:#19E6D6; color:#000; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-family:'MedievalSharp', cursive;">${i + 1}</div>
              <span style="color:#fff; font-family:'MedievalSharp', cursive;">${s.name}</span>
            </div>
            <div style="color:#19E6D6; font-weight:bold; font-size:18px; font-family:'MedievalSharp', cursive;">${s.count}</div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- Información de la biblioteca -->
    <div style="margin-top:30px; padding:20px; background:rgba(25,230,214,0.05); border:1px solid rgba(25,230,214,0.2); border-radius:8px;">
      <h3 style="font-family:'MedievalSharp', cursive; color:#19E6D6; margin-top:0;">Información de la Biblioteca</h3>
      <p style="color:#ccc; line-height:1.8; margin:0;">
        <strong>Última actualización:</strong> ${new Date().toLocaleString('es-ES')}<br>
        <strong>Versión:</strong> Azkaban Reads v1.0<br>
        <strong>Estado:</strong> En línea<br>
        <strong>Total de Elementos:</strong> ${totalLibros + totalAutores + totalSagas}
      </p>
    </div>
    
    <p style="text-align:center; margin-top:30px;">
      <a href="/" class="button">← Volver a Inicio</a>
    </p>
  </div>
</body>
</html>`);
});

app.listen(PORT,()=>console.log(`Servidor escuchando en puerto ${PORT}`));
