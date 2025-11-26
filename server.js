const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();

// Servir carpeta cover
app.use('/cover', express.static(path.join(__dirname, 'cover')));

// ID de la carpeta pública de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const PORT = process.env.PORT || 3000;

// Leer imágenes cover locales
let coverImages = [];
try {
  coverImages = fs.readdirSync(path.join(__dirname, 'cover')).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders.');
}

// Instancia de Google Drive con API Key
const drive = google.drive({
  version: 'v3',
  auth: 'AIzaSyAKD8XSGB8wCb8tq9Z5mT20AS6nI_lQ0IY'
});

// CSS actualizado
const css = `
@import url("https://db.onlinewebfonts.com/c/852651dd87a0da3b4f8f8f01afca866e?family=Letter+Gothic+Extra+Bold");
@import url("https://db.onlinewebfonts.com/c/ee6883e353ce9d6f08983a8273ad664b?family=OfficinaSansMediumC");

body {
  font-family: 'OfficinaSansMediumC', sans-serif;
  margin:10px;
  padding:0;
  background:#f5f3ef;
  color:#3e3a36;
}

header {
  text-align:center;
  margin-bottom:10px;
}

h1 {
  font-family: 'Letter Gothic Extra Bold', monospace;
  font-size: 36px;
  color:#5b3a21;
  text-shadow: 1px 1px 0 #a67c4e;
  margin-bottom: 10px;
}

#grid {
  display:flex;
  flex-direction:column;
  gap:8px;
  padding-bottom:20px;
}

.libro {
  display:flex;
  flex-direction:row;
  align-items:center;
  gap:12px;
  background: rgba(210, 200, 180, 0.85);
  padding:10px 12px;
  border-radius:8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.libro:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.placeholder {
  width: 60px;
  height: 90px;
  border-radius: 6px;
  overflow: hidden;
  background: #c9b8a3;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.titulo {
  font-family: 'OfficinaSansMediumC', sans-serif;
  font-size:13px;
  color:#3e3a36;
  font-weight:500;
  flex-grow:1;
  overflow:hidden;
  text-overflow:ellipsis;
}

.meta a {
  padding:3px 8px;
  border-radius:4px;
  text-decoration:none;
  background:#c49a6c;
  color:#fff;
  font-size:11px;
}

.meta a:hover {
  background:#a67c4e;
}

input, select {
  margin-top:8px;
  padding:6px 10px;
  border-radius:15px;
  border:1px solid #6b5e4d;
  width:90%;
  font-size:14px;
  background:#f5f3ef;
  color:#3e3a36;
}
`;

// Ruta principal
app.get('/', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, createdTime)',
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
    res.send('<p>Error al cargar los libros.</p>');
  }
});

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
