require('dotenv').config();
const axios = require('axios');

const PRODUCCION_URL = 'https://bibliokobo.onrender.com';

async function testProduccion() {
  console.log('🚀 Probando BiblioKobo en PRODUCCIÓN\n');
  console.log('URL:', PRODUCCION_URL);
  console.log('='.repeat(60));
  
  // 1. Verificar que el servidor responde
  console.log('\n1️⃣ Verificando servidor...');
  try {
    console.time('   Tiempo de respuesta');
    const healthCheck = await axios.get(`${PRODUCCION_URL}/api/books/search?q=harry`, {
      timeout: 60000 // 60 segundos para el "cold start" de Render
    });
    console.timeEnd('   Tiempo de respuesta');
    console.log('   ✅ Servidor respondiendo correctamente');
    console.log('   📊 Estado:', healthCheck.status);
    console.log('   📚 Libros encontrados:', healthCheck.data.books?.length || 0);
  } catch (error) {
    console.timeEnd('   Tiempo de respuesta');
    if (error.code === 'ECONNABORTED') {
      console.log('   ⏱️  Timeout - El servidor está "dormido", esperando que despierte...');
      console.log('   ℹ️  En Render gratuito esto es normal en el primer request');
      console.log('   ⏳ Espera 30-60 segundos y vuelve a intentar');
      return;
    } else if (error.response && error.response.status < 500) {
      console.log('   ✅ Servidor activo (respuesta HTTP:', error.response.status + ')');
      // Continuar aunque haya dado error 400, el servidor está vivo
    } else {
      console.log('   ❌ Error:', error.message);
      return;
    }
  }
  
  // 2. Probar endpoint de solicitud
  console.log('\n2️⃣ Probando solicitud de libro...');
  
  const requestData = {
    title: 'Prueba desde Terminal - ' + new Date().toLocaleTimeString(),
    author: 'Sistema de Testing',
    email: 'mgdomm@icloud.com'
  };
  
  try {
    console.log('   📨 Enviando solicitud...');
    console.log('   Libro:', requestData.title);
    console.log('   Email:', requestData.email);
    console.time('   Tiempo de respuesta');
    
    const response = await axios.post(`${PRODUCCION_URL}/api/requests/book`, requestData, {
      timeout: 20000 // 20 segundos
    });
    
    console.timeEnd('   Tiempo de respuesta');
    console.log('   ✅ Respuesta recibida:');
    console.log('   Mensaje:', response.data.message);
    console.log('   Success:', response.data.success);
    
    if (response.data.success) {
      console.log('\n✅ ¡TODO FUNCIONA EN PRODUCCIÓN!');
      console.log('');
      console.log('Ahora verifica en Render:');
      console.log('  1. Ve a https://dashboard.render.com');
      console.log('  2. Selecciona tu servicio BiblioKobo');
      console.log('  3. Haz clic en "Logs"');
      console.log('  4. Busca esta línea:');
      console.log('     "✅ Email de solicitud enviado exitosamente al admin"');
      console.log('');
      console.log('Y revisa tu email:');
      console.log('  📧 azkabanreads@gmail.com (debería tener la solicitud)');
    }
    
  } catch (error) {
    console.timeEnd('   Tiempo de respuesta');
    console.log('   ❌ Error al hacer solicitud:');
    
    if (error.code === 'ECONNABORTED') {
      console.log('   ⏱️  Timeout - La respuesta tardó más de 20 segundos');
      console.log('   ℹ️  Esto puede indicar que el email está tardando');
      console.log('   🔍 Verifica los logs en Render para más detalles');
    } else if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Mensaje:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📝 INSTRUCCIONES PARA VER LOGS EN RENDER:');
  console.log('  1. Abre https://dashboard.render.com');
  console.log('  2. Haz clic en tu servicio "BiblioKobo"');
  console.log('  3. En el menú lateral, haz clic en "Logs"');
  console.log('  4. Busca las líneas más recientes');
  console.log('  5. Verifica que no haya errores de email');
  console.log('');
}

console.log('⏳ Esperando 3 segundos antes de empezar...');
console.log('   (Para dar tiempo a que Render termine de desplegar)');
setTimeout(() => {
  testProduccion();
}, 3000);
