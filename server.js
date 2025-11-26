const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const app = express();

// Servir fuentes y covers
app.use('/fonts', express.static('fonts'));
app.use('/cover', express.static('cover'));

// Configuración de Google Service Account
const SERVICE_ACCOUNT_JSON = path.join(__dirname, 'service-account.json'); // tu JSON descargado
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const PORT = process.env.PORT || 3000;

// Leer imágenes cover
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname,'cover')).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// Autenticación con cuenta de servicio
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_JSON,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});
const drive = google.drive({ version: 'v3', auth });

// CSS
const css = `
@font-face { font-family: 'Letter Gothic'; src: url('/fonts/LetterGothic.woff') format('woff'); font-weight: bold; }
@font-face { font-family: 'Officina'; src: url('/fonts/Officina.woff') format('woff'); }

body { font-family: 'Officina', sans-serif; margin:0; padding:20px; background:#1c1c1c; color:#f5f3ef; }
header { text-align:center; margin-bottom:20px; }

h1 { 
  font-family: 'Letter Gothic', monospace; 
  font-weight: bold;
  font-size: 52px;
  color:#c49a6c;
  text-shadow: 2px 2px 0 #a67c4e, 4px 4px 0 rgba(0,0,0,0.25), 6px 6px 0 rgba(0,0,0,0.2);
  margin-bottom: 20px;
}

#grid { display:flex; flex-direction:column; gap:12px; padding-bottom:40px; }

.libro {
  display:flex; flex-direction:row; align-items:center; gap:12px;
  background: rgba(120,100,70,0.85);
  padding:10px 12px; border-radius:10px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.libro:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.1); }

.placeholder {
  width:1.5cm; height:2.2cm; border-radius:4px;
  flex-shrink:0; object-fit:cover;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.titulo { font-family: 'Officina', sans-serif; font-size:14px; color:#f5f3ef; font-weight:500; flex-grow:1; overflow:hidden; text-overflow:ellipsis; }

.meta a { padding:4px 10px; border-radius:6px; text-decoration:none; background:#c49a6c; color:#fff; font-size:12px; transition: background 0.2s; }
.meta a:hover { background:#a67c4e; }

input, select { margin-top:10px; padding:8px 12px; border-radius:20px; border:1px solid #6b5e4d; width:80%; max-width:400px; font-size:16px; background:#2c2c2c; color:#f5f3ef; }
`;

app.get('/', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
      pageSize: 1000,
    });

    const files = response.data.files || [];

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Mi Biblioteca</title>
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
    const imgHtml = cover ? '<img src="'+cover+'" class="placeholder">' : '<div class="placeholder">📖</div>';
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

// Render inicial
renderFiles(ordenarFiles('alfabetico'));

// Eventos
input.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  renderFiles(ordenarFiles(ordenar.value).filter(f=>f.name.toLowerCase().includes(q)));
});

ordenar.addEventListener('change', e => {
  const q = input.value.toLowerCase();
  renderFiles(ordenarFiles(ordenar.value).filter(f=>f.name.toLowerCase().includes(q)));
});
</script>
</body>
</html>`;

    res.send(html);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar los libros. Revisa permisos de la cuenta de servicio y que la carpeta esté compartida con ella.</p>');
  }
});

app.listen(PORT, ()=>console.log(`Servidor escuchando en puerto ${PORT}`));
