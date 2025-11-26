const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();

// Servir carpeta cover
app.use('/cover', express.static(path.join(__dirname, 'cover')));

// Ruta a tu JSON de Service Account
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'service-account.json');

// ID de la carpeta de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const PORT = process.env.PORT || 3000;

// Leer imágenes cover locales
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname,'cover')).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// Autenticación con Service Account
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

const drive = google.drive({ version: 'v3', auth });

// CSS vintage oscuro + portadas 1.5cm
const css = `
body {
  font-family: sans-serif;
  margin:10px; padding:0;
  background:#2e2b25; color:#f5f3ef;
}
header { text-align:center; margin-bottom:10px; }
h1 { font-size:36px; color:#d4c0a1; text-shadow:1px 1px 0 #8b735e; margin-bottom:10px; }
#grid { display:flex; flex-direction:column; gap:10px; padding-bottom:20px; }
.libro {
  display:flex; align-items:center; gap:12px;
  background: #3e3a36; padding:10px 12px; border-radius:8px;
  box-shadow:0 2px 6px rgba(0,0,0,0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: 100px;
}
.libro:hover { transform: translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.5); }
.placeholder {
  width:1.5cm; height:2.25cm; border-radius:6px; overflow:hidden;
  background:#8b735e; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; font-size:16px; color:#f5f3ef;
}
.cover-img { width:100%; height:100%; object-fit:cover; border-radius:6px; }
.titulo { flex-grow:1; overflow:hidden; text-overflow:ellipsis; font-size:14px; color:#f5f3ef; }
.meta a { padding:3px 8px; border-radius:4px; text-decoration:none; background:#c49a6c; color:#fff; font-size:11px; }
.meta a:hover { background:#a67c4e; }
input, select { margin-top:8px; padding:6px 10px; border-radius:15px; border:1px solid #6b5e4d;
  width:90%; font-size:14px; background:#3e3a36; color:#f5f3ef;
}
`;

// Ruta principal
app.get('/', async (req, res) => {
  try {
    // Listar archivos de la carpeta
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,createdTime)',
      pageSize: 1000
    });

    const files = response.data.files || [];

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Mi Biblioteca Kobo</title>
<style>${css}</style>
</head>
<body>
<header>
<h1>📚 Mi Biblioteca</h1>
<input id="buscar" type="search" placeholder="Buscar título..." />
<select id="ordenar">
  <option value="alfabetico">Alfabético</option>
  <option value="autor">Por Autor</option>
  <option value="recientes">Más recientes</option>
</select>
</header>
<div id="grid"></div>
<script>
const files = ${JSON.stringify(files)};
const covers = ${JSON.stringify(coverImages)};
const grid = document.getElementById('grid');
const input = document.getElementById('buscar');
const ordenar = document.getElementById('ordenar');

function renderFiles(list) {
  grid.innerHTML = list.map(file => {
    const cover = covers.length ? covers[Math.floor(Math.random()*covers.length)] : null;
    const imgHtml = cover ? '<img src="'+cover+'" class="cover-img">' : '<div class="placeholder">📖</div>';
    return \`
<div class="libro">
  \${imgHtml}
  <div class="titulo">\${file.name}</div>
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=\${file.id}" target="_blank">Descargar</a></div>
</div>\`;
  }).join('');
}

function ordenarFiles(criteria) {
  let sorted = [...files];
  if(criteria==='alfabetico') sorted.sort((a,b)=> a.name.localeCompare(b.name));
  else if(criteria==='autor') sorted.sort((a,b)=> (a.name.split('-')[0]||'').trim().localeCompare((b.name.split('-')[0]||'').trim()));
  else if(criteria==='recientes') sorted.sort((a,b)=> new Date(b.createdTime)-new Date(a.createdTime));
  return sorted;
}

renderFiles(ordenarFiles('alfabetico'));

input.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderFiles(ordenarFiles(ordenar.value).filter(f => f.name.toLowerCase().includes(q)));
});

ordenar.addEventListener('change', e => {
  const q = input.value.toLowerCase();
  renderFiles(ordenarFiles(ordenar.value).filter(f => f.name.toLowerCase().includes(q)));
});
</script>
</body>
</html>
`;

    res.send(html);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar los libros. Revisa permisos de la carpeta y Service Account.</p>');
  }
});

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
