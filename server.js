const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Tus datos de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const apiKey = 'AIzaSyBZQnrDOm-40Mk6l9Qt48tObQtjWtM8IdA';

const PORT = process.env.PORT || 3000;

const css = `
@import url('https://fonts.googleapis.com/css2?family=MedievalSharp&family=Roboto+Slab&display=swap');

body { 
  font-family: 'Roboto Slab', serif; 
  margin:0; padding:20px; 
  background:#f5f3ef; color:#3e3a36; 
}

header { text-align:center; margin-bottom:20px; }

h1 { 
  font-family: 'MedievalSharp', cursive; 
  color:#c49a6c; 
  font-size:32px; 
  text-shadow: 2px 2px 4px rgba(0,0,0,0.15);
  margin-bottom: 10px;
}

#grid { 
  display:flex; flex-direction:column; gap:14px; padding-bottom:40px; 
}

.libro { 
  background:#fff8f0; border-radius:8px; padding:12px; 
  display:flex; flex-direction:row; align-items:center; gap:12px; 
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.placeholder { 
  width:60px; height:90px; border-radius:6px; 
  display:flex; align-items:center; justify-content:center; 
  font-size:36px; flex-shrink:0; 
  background: #e0d6c3;
  box-shadow: inset 0 4px 6px rgba(0,0,0,0.05);
}

.titulo { 
  font-family: 'Roboto Slab', serif;
  font-size:15px; 
  font-weight:500; 
  flex-grow:1; 
  overflow:hidden; text-overflow:ellipsis;
}

.meta a { 
  padding:4px 10px; border-radius:6px; text-decoration:none; 
  background:#c49a6c; color:#fff; font-size:12px; 
  transition: background 0.2s;
}

.meta a:hover { 
  background:#a67c4e; 
}

input#buscar { 
  margin-top:10px; padding:8px 12px; border-radius:20px; 
  border:1px solid #6b5e4d; width:80%; max-width:400px; font-size:16px; 
}
`;

app.get('/', async (req, res) => {
  try {
    const endpoint = 'https://www.googleapis.com/drive/v3/files';
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      key: apiKey,
      fields: 'files(id,name)',
      pageSize: '1000'
    });

    const response = await fetch(`${endpoint}?${params}`);
    const data = await response.json();

    const colors = ['#c49a6c','#8b5e3c','#d9a066','#a67c4e','#b78e62','#c9b78e','#b07c52'];

    const listItems = (data.files || []).map(file => {
      const color = colors[Math.floor(Math.random()*colors.length)];
      return `
      <div class="libro">
        <div class="placeholder" style="background:${color}">📖</div>
        <div class="titulo">${file.name}</div>
        <div class="meta"><a href="https://drive.google.com/uc?export=download&id=${file.id}" target="_blank">Descargar</a></div>
      </div>`;
    }).join('\n');

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
      </header>
      <div id="grid">${listItems}</div>
      <script>
        const input = document.getElementById('buscar');
        input.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          document.querySelectorAll('.libro').forEach(card => {
            const title = card.querySelector('.titulo').textContent.toLowerCase();
            card.style.display = title.includes(q) ? '' : 'none';
          });
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
