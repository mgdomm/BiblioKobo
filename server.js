const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();

// Servir archivos de fuentes y covers
app.use('/fonts', express.static('fonts'));
app.use('/covers', express.static('cover')); // <--- carpeta covers

// Datos de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const apiKey = 'AIzaSyBZQnrDOm-40Mk6l9Qt48tObQtjWtM8IdA';
const PORT = process.env.PORT || 3000;

// Leer imágenes de covers
const coverDir = path.join(__dirname, 'covers');
const coverImages = fs.readdirSync(coverDir).map(f => `/covers/${f}`);

const css = `
@font-face { font-family: 'Letter Gothic'; src: url('/fonts/LetterGothic.woff') format('woff'); font-weight: normal; font-style: normal; }
@font-face { font-family: 'Officina'; src: url('/fonts/Officina.woff') format('woff'); font-weight: normal; font-style: normal; }

body { font-family: 'Officina', sans-serif; margin:0; padding:20px; background:#f5f3ef; color:#3e3a36; }

header { text-align:center; margin-bottom:20px; }

h1 { 
  font-family: 'Letter Gothic', monospace; 
  font-weight: bold;
  font-size: 48px;
  color:#c49a6c;
  text-shadow: 
    2px 2px 0 #a67c4e,
    4px 4px 0 rgba(0,0,0,0.15),
    6px 6px 0 rgba(0,0,0,0.1);
  margin-bottom: 15px;
}

#grid { display:flex; flex-direction:column; gap:14px; padding-bottom:40px; }

.libro { 
  background:#fff8f0; border-radius:8px; padding:12px; 
  display:flex; flex-direction:row; align-items:center; gap:12px; 
  box-shadow: 0 4px 8px rgba(0,0,0,0.1); 
  transition: transform 0.2s, box-shadow 0.2s;
}

.libro:hover { transform: translateY(-2px); box-shadow: 0 8px 12px rgba(0,0,0,0.15); }

.placeholder { 
  width:60px; height:90px; border-radius:6px; overflow:hidden; flex-shrink:0; 
  box-shadow: inset 0 4px 6px rgba(0,0,0,0.05); 
  transition: background 0.2s;
}

.placeholder img { width:100%; height:100%; object-fit:cover; }

.titulo { font-family: 'Officina', sans-serif; font-size:15px; font-weight: normal; flex-grow:1; overflow:hidden; text-overflow:ellipsis; }

.meta a { padding:4px 10px; border-radius:6px; text-decoration:none; background:#c49a6c; color:#fff; font-size:12px; transition: background 0.2s; }

.meta a:hover { background:#a67c4e; }

input, select { margin-top:10px; padding:8px 12px; border-radius:20px; border:1px solid #6b5e4d; width:80%; max-width:400px; font-size:16px; }
`;

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
    const cover = covers[Math.floor(Math.random()*covers.length)];
    return \`
<div class="libro">
  <div class="placeholder"><img src="\${cover}" alt="Libro"></div>
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
