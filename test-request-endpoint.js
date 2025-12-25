require('dotenv').config();
const axios = require('axios');

const SERVER_URL = process.env.SITE_URL || 'http://localhost:3000';

async function testRequestEndpoint() {
  console.log('🧪 Probando endpoint de solicitud de libro...\n');
  console.log('Servidor:', SERVER_URL);
  console.log('');
  
  const requestData = {
    title: 'El Hobbit - Prueba',
    author: 'J.R.R. Tolkien',
    email: 'mgdomm@icloud.com'
  };
  
  try {
    console.log('Enviando solicitud...');
    console.time('Tiempo de respuesta');
    
    const response = await axios.post(`${SERVER_URL}/api/requests/book`, requestData, {
      timeout: 30000 // 30 segundos de timeout
    });
    
    console.timeEnd('Tiempo de respuesta');
    console.log('');
    console.log('✅ Respuesta recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    
    if (response.data.success) {
      console.log('✅ Solicitud procesada correctamente');
      console.log('');
      console.log('Ahora verifica:');
      console.log('  1. Si recibiste un email en mgdomm@icloud.com (revisa spam)');
      console.log('  2. Si el admin recibió notificación en azkabanreads@gmail.com');
    } else {
      console.log('❌ La solicitud no fue exitosa');
    }
    
  } catch (error) {
    console.timeEnd('Tiempo de respuesta');
    console.error('');
    console.error('❌ Error al hacer la solicitud:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('⚠️  No se pudo conectar al servidor');
      console.error('   Verifica que el servidor esté corriendo:');
      console.error('   - Localmente: npm start');
      console.error('   - Producción: verifica que el servidor esté activo');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.error('');
      console.error('⏱️  Timeout - El servidor tardó demasiado en responder');
      console.error('   Esto puede indicar que el envío de email está tardando mucho');
    } else if (error.response) {
      console.error('');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('');
      console.error('Mensaje:', error.message);
    }
  }
}

testRequestEndpoint();
