const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const CREDENTIALS_PATH = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function generateToken() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ No existe oauth-credentials.json');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('\n🔗 Abre este URL en tu navegador (copia y pega):');
  console.log('═'.repeat(80));
  console.log(authUrl);
  console.log('═'.repeat(80));
  
  console.log('\n⏳ Esperando autorización en http://localhost:3000/oauth-callback');
  console.log('(Si el navegador se abre pero no funciona, intenta acceder manualmente)\n');

  // Crear servidor HTTP para recibir el callback
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/oauth-callback') {
      const code = parsedUrl.query.code;
      const error = parsedUrl.query.error;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>❌ Error: ${error}</h1><p>${parsedUrl.query.error_description || ''}</p>`);
        console.error('❌ Error:', error);
        server.close();
        process.exit(1);
      }

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received');
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        console.log('✅ Token guardado en oauth-token.json');
        console.log('📝 Token info:', {
          access_token: tokens.access_token.substring(0, 20) + '...',
          expires_in: tokens.expires_in,
          token_type: tokens.token_type
        });

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
                .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; color: #155724; }
                h1 { margin: 0; }
              </style>
            </head>
            <body>
              <div class="success">
                <h1>✅ ¡Autorización exitosa!</h1>
                <p>Tu token se ha guardado correctamente.</p>
                <p>Puedes cerrar esta ventana y ejecutar el servidor.</p>
              </div>
            </body>
          </html>
        `);

        console.log('\n🎉 ¡Listo! Puedes iniciar el servidor con: npm start\n');
        server.close();
        process.exit(0);
      } catch (err) {
        console.error('❌ Error al obtener token:', err.message);
        res.writeHead(500);
        res.end('Error: ' + err.message);
        server.close();
        process.exit(1);
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(3000, () => {
    console.log('✅ Servidor escuchando en http://localhost:3000/oauth-callback\n');
    // Intentar abrir el navegador automáticamente
    const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    require('child_process').exec(start + ' "' + authUrl + '"');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('❌ El puerto 3000 está en uso. Asegúrate de que el servidor no esté corriendo.');
      process.exit(1);
    }
  });
}

generateToken().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
