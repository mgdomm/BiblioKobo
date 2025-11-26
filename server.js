const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();

// Servir archivos de fuentes y cover
app.use('/fonts', express.static('fonts'));
app.use('/cover', express.static('cover'));

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

const css = `
@font-face { font-family: 'Letter Gothic'; src: url('/fonts/LetterGothic.woff') format('woff'); font-weight: normal; font-style: normal; }
@font-face { font-family: 'Officina'; src: url('/fonts/Officina.woff') format('woff'); font-weight: normal; font-style: normal; }

body { 
  font-family: 'Officina', sans-serif; 
  margin:0; padding:20px; 
  background:#f5f3ef; 
  color:#3e3a36; 
}

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
  margin-bottom: 20px;
}

#grid { 
  display:flex; 
  flex-direction:column; 
  gap:12px; 
  padding-bottom:40px; 
}

.libro {
  display:flex; 
  flex-direction:row; 
  align-items:center; 
  gap:14px;
  background: rgba(190, 175, 150, 0.85); /* beige más oscuro */
  padding:12px 14px; 
  border-radius:10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.libro:hover { 
  transform: translateY(-2px); 
  box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
}

.placeholder {
  width: 60px;
  height: 90px;
  border-radius:6px;
  background:#d2c4ad;
  overflow:hidden;
  flex-shrink: 0;
  display:flex;
  align-items:center;
  justify-content:center;
}

.placeholder img {
  width:100%;
  height:100%;
  object-fit:cover;
}

.titulo { 
  font-family: 'Officina', sans-serif; 
  font-size:15px; 
  color:#5b3a21; 
  font-weight:500; 
  flex-grow:1; 
  overflow:hidden; 
  text-overflow:ellipsis; 
}

.meta a { 
  padding:4px 10px; 
  border-radius:6px; 
  text-decoration:none; 
  background:#c49a6c; 
  color:#fff; 
  font-size:12px; 
  transition: background 0.2s; 
}
.meta a:hover { background:#a67c4e; }

input, select { 
  margin-top:10px; 
  padding:8px 12px; 
  border-radius:20px; 
  border:1px solid #6b5e4d; 
  width:80%; 
  max-width:400px; 
  font-size:16px; 
}
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
const files = ${JSON.stringify(files)};
const covers = ${JSON.stringify(coverImages)};

const grid = document.getElementById('grid');
const input = document.getElementById('buscar');
const ordenar = document.getElementById('ordenar');

function renderFiles(list) {
  grid.innerHTML = list.map(file => {
    const cover = covers.length > 0 
      ? covers[Math.floor(Math.random()*covers.length)]
      : null;

    const placeholderHtml = cover
      ? \`<div class="placeholder"><img src="\${cover}"></div>\`
      : '<div class="placeholder">📖</div>';

    return \`
<div class="libro">
  \${placeholderHtml}
  <div class="titulo">\${file.name}</div>
  <div class="meta"><a href="https://drive.google.com/uc?export=download&id=\${file.id}" target="_blank">Descargar</a></div>
</div>\`;
  }).join('');
}

function ordenarFiles(criteria) {
  let sorted = [...files];

  if(criteria === 'alfabetico') {
    sorted.sort((a,b)=> a.name.localeCompare(b.name));
  } 
  else if(criteria === 'autor') {
    sorted.sort((a,b)=> {
      const autorA = a.name.split('-')[0]?.trim() || '';
      const autorB = b.name.split('-')[0]?.trim() || '';
      return autorA.localeCompare(autorB);
    });
  } 
  else if(criteria === 'recientes') {
    sorted.sort((a,b)=> new Date(b.createdTime) - new Date(a.createdTime));
  }

  return sorted;
}

renderFiles(ordenarFiles('alfabetico'));

input.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = ordenarFiles(ordenar.value).filter(f => f.name.toLowerCase().includes(q));
  renderFiles(filtered);
});

ordenar.addEventListener('change', () => {
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
