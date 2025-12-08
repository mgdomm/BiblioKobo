const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');

console.log('\n' + '═'.repeat(80));
console.log('🔑 GENERADOR MANUAL DE TOKEN OAUTH PARA GOOGLE DRIVE');
console.log('═'.repeat(80) + '\n');

console.log('Opción 1: Generar token directamente desde Google\n');
console.log('1. Abre este URL en tu navegador:');
console.log('   https://accounts.google.com/o/oauth2/v2/auth?');
console.log('   client_id=998362724306-bsln61ldh1anm21g4g302m5b3cjcp6ts.apps.googleusercontent.com');
console.log('   &redirect_uri=http://localhost');
console.log('   &response_type=code');
console.log('   &scope=https://www.googleapis.com/auth/drive');
console.log('   &access_type=offline');
console.log('\n2. Google te redirigirá a una URL como: http://localhost?code=XXXXX...');
console.log('3. Copia el valor de "code=XXXXX" (todo después de "code=" hasta el siguiente &)\n');

rl.question('Pega aquí el código de autorización (o escribe "skip" para saltarlo): ', async (code) => {
  if (code.toLowerCase() === 'skip') {
    console.log('\n⏭️  Saltando generación de token...\n');
    rl.close();
    process.exit(0);
  }

  if (!code || code.length < 10) {
    console.error('❌ Código inválido');
    rl.close();
    process.exit(1);
  }

  try {
    // Hacer request para intercambiar el código por un token
    const https = require('https');
    const querystring = require('querystring');

    const postData = querystring.stringify({
      code: code,
      client_id: '998362724306-bsln61ldh1anm21g4g302m5b3cjcp6ts.apps.googleusercontent.com',
      client_secret: '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',
      redirect_uri: 'http://localhost',
      grant_type: 'authorization_code'
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tokenData = JSON.parse(data);
          
          if (tokenData.error) {
            console.error(`❌ Error: ${tokenData.error}`);
            console.error(`   ${tokenData.error_description || ''}`);
            rl.close();
            process.exit(1);
          }

          // Guardar el token
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
          
          console.log('\n✅ ¡Token generado exitosamente!\n');
          console.log('📝 Detalles del token:');
          console.log(`   access_token: ${tokenData.access_token.substring(0, 30)}...`);
          console.log(`   expires_in: ${tokenData.expires_in} segundos`);
          console.log(`   token_type: ${tokenData.token_type}`);
          console.log(`   scope: ${tokenData.scope}\n`);
          console.log('📁 Guardado en: oauth-token.json\n');
          console.log('🎉 ¡Listo! Ahora puedes iniciar el servidor con: npm start\n');
          
          rl.close();
          process.exit(0);
        } catch (e) {
          console.error('❌ Error al parsear respuesta:', e.message);
          rl.close();
          process.exit(1);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Error en la solicitud:', e.message);
      rl.close();
      process.exit(1);
    });

    req.write(postData);
    req.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    rl.close();
    process.exit(1);
  }
});
