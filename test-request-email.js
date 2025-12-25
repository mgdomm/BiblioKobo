require('dotenv').config();
const emailService = require('./services/emailService');

async function testRequestEmail() {
  console.log('📧 Probando envío de email de solicitud al admin...\n');
  console.log('Configuración:');
  console.log('  EMAIL_USER:', process.env.EMAIL_USER);
  console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Configurado' : '❌ No configurado');
  console.log('');
  
  try {
    console.log('Enviando email de notificación de solicitud al admin...');
    console.log('Usuario solicitante: mgdomm@icloud.com');
    console.log('Libro: "El Hobbit"');
    console.log('Autor: "J.R.R. Tolkien"\n');
    
    const result = await emailService.sendBookRequestNotificationToAdmin(
      'mgdomm@icloud.com',
      'El Hobbit',
      'J.R.R. Tolkien'
    );
    
    console.log('');
    if (result) {
      console.log('✅ ¡Email de solicitud enviado exitosamente al admin!');
      console.log('');
      console.log('Revisa tu bandeja de entrada en azkabanreads@gmail.com');
      console.log('Si no lo ves, revisa la carpeta de Spam/Correo no deseado');
    } else {
      console.log('❌ El email retornó false - revisa los logs arriba');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Error al enviar email de solicitud:');
    console.error('');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    console.error('');
    if (error.code === 'EAUTH') {
      console.error('⚠️  Error de autenticación. Verifica:');
      console.error('   1. Que EMAIL_USER sea correcto: azkabanreads@gmail.com');
      console.error('   2. Que EMAIL_PASS sea la contraseña de aplicación (no tu contraseña normal)');
      console.error('   3. Que la contraseña no tenga espacios extra al inicio o final');
    }
  }
}

testRequestEmail();
