const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Tus datos de Google Drive
const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
const apiKey = 'AIzaSyBZQnrDOm-40Mk6l9Qt48tObQtjWtM8IdA';

const PORT = process.env.PORT || 3000;

const css = `
body { font-family: 'Georgia', serif; margin:0; padding:20px; background:#f5f3ef; color:#3e3a36; }
header { text-align:center; margin-bottom:20px; }
h1 { color:#c49a6c; font-size:28px; }
#grid { display:flex; flex-direction:column; gap:12px; padding-bottom:40px; }
.libro { background:#fff8f0; border-radius:6px; padding:12px; display:flex; flex-direction:row; align-items:center; gap:12px; }
.placeholder { width:80px; height:120px; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:48px; flex-shrink:0; }
.titulo { font-size:16px; font-weight:bold; flex-grow:1; }
.meta a { padding:4px 10px; border-radius:6px; text-decoration:none; background:#c49a6c; color:#fff; font-size:12px; }
input#buscar { margin-top:10px; padding:8px 12px; border-radius:20px; border:1px solid #6b5e4d; width:80%; max-width:400px; font-size:16px; }
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
