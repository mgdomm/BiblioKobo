const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();

// Servir archivos de fuentes y cover
app.use('/fonts', express.static('fonts'));
app.use('/cover', express.static('cover')); // <- carpeta singular

// Datos de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const apiKey = 'AIzaSyBZQnrDOm-40Mk6l9Qt48tObQtjWtM8IdA';
const PORT = process.env.PORT || 3000;

// Leer imágenes de cover
let coverImages = [];
const coverDir = path.join(__dirname, 'cover');
try {
  coverImages = fs.readdirSync(coverDir).map(f => `/cover/${f}`);
} catch(err) {
  console.warn('No se encontró la carpeta cover. Se usarán placeholders de color.');
}

const css = `...`; // tu CSS como antes

app.get('/', async (req, res) => {
  try {
    const endpoint = 'https://www.googleapis.com/drive/v3/files';
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      key: apiKey,
      fields: 'files(id,name,createdTime)',
      pageSize: '1000'
    });

    const response = await fetch(`${endpoint}?${params}`);
    const data = await response.json();
    const files = data.files || [];
    const colors = ['#c49a6c','#8b5e3c','#d9a066','#a67c4e','#b78e62','#c9b78e','#b07c52'];

    const html = `<!DOCTYPE html>
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
const colors = ${JSON.stringify(colors)};
const files = ${JSON.stringify(files)};
const covers = ${JSON.stringify(coverImages)};

const grid = document.getElementById('grid');
const input = document.getElementById('buscar');
const ordenar = document.getElementById('ordenar');

function renderFiles(list) {
  grid.innerHTML = list.map(file => {
    const color = colors[Math.floor(Math.random()*colors.length)];
    const cover = covers.length > 0 ? covers[Math.floor(Math.random()*covers.length)] : null;
    const placeholderHtml = cover ? \`<img src="\${cover}" alt="Libro">\` : '📖';
    return \`
<div class="libro">
  <div class="placeholder">\${placeholderHtml}</div>
  <div class="titulo">\${file.name}</div>
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=\${file.id}" target="_blank">Descargar</a></div>
</div>\`;
  }).join('');
}

function ordenarFiles(criteria) {
  let sorted = [...files];
  if(criteria === 'alfabetico') {
    sorted.sort((a,b)=> a.name.localeCompare(b.name));
  } else if(criteria === 'autor') {
    sorted.sort((a,b)=> {
      const autorA = a.name.split('-')[0]?.trim() || '';
      const autorB = b.name.split('-')[0]?.trim() || '';
      return autorA.localeCompare(autorB);
    });
  } else if(criteria === 'recientes') {
    sorted.sort((a,b)=> new Date(b.createdTime) - new Date(a.createdTime));
  }
  return sorted;
}

// Render inicial
renderFiles(ordenarFiles('alfabetico'));

// Eventos
input.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = ordenarFiles(ordenar.value).filter(f => f.name.toLowerCase().includes(q));
  renderFiles(filtered);
});

ordenar.addEventListener('change', e => {
  const filtered = ordenarFiles(ordenar.value).filter(f => f.name.toLowerCase().includes(input.value.toLowerCase()));
  renderFiles(filtered);
});
</script>
</body>
</html>`;

    res.send(html);
  } catch(err) {
    console.error(err);
    res.send('<p>Error al cargar los libros.</p>');
  }
});

app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
