const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// INSTRUCCIONES:
// 1. Ve a https://console.cloud.google.com/apis/credentials
// 2. Crea credenciales OAuth 2.0 (tipo "Aplicación de escritorio")
// 3. Descarga el JSON y guárdalo como oauth-credentials.json en esta carpeta
// 4. Ejecuta: node generate-oauth-token.js

const CREDENTIALS_PATH = path.join(__dirname, 'oauth-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function generateToken() {
  // Leer credenciales
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ No existe oauth-credentials.json');
    console.log('\n📝 Pasos:');
    console.log('1. Ve a: https://console.cloud.google.com/apis/credentials');
    console.log('2. Crea credenciales → OAuth 2.0 Client ID → Desktop app');
    console.log('3. Descarga el JSON como "oauth-credentials.json"');
    console.log('4. Ponlo en:', __dirname);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Generar URL de autorización
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('🔐 Autoriza esta app visitando esta URL:\n');
  console.log(authUrl);
  console.log('\n📋 Copia el código que te dan y pégalo aquí:');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Código: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('\n✅ Token guardado en:', TOKEN_PATH);
      console.log('✅ Ahora puedes usar el endpoint de carga de archivos');
    } catch (err) {
      console.error('❌ Error obteniendo token:', err.message);
    }
  });
}

generateToken();
