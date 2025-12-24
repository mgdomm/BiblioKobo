require('dotenv').config();
const emailService = require('./services/emailService');

async function testEmail() {
  console.log('📧 Probando envío de email...\n');
  console.log('Configuración:');
  console.log('  EMAIL_USER:', process.env.EMAIL_USER);
  console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Configurado' : '❌ No configurado');
  console.log('');
  
  try {
    console.log('Enviando email de prueba a azkabanreads@gmail.com...');
    
    await emailService.sendBookCapturedEmail(
      'azkabanreads@gmail.com',
      'Prueba LUMOS - Sistema Funcionando',
      'Equipo de Desarrollo',
      'http://localhost:3000/lumos-demo.html'
    );
    
    console.log('');
    console.log('✅ ¡Email enviado exitosamente!');
    console.log('');
    console.log('Revisa tu bandeja de entrada en azkabanreads@gmail.com');
    console.log('Si no lo ves, revisa la carpeta de Spam/Correo no deseado');
    console.log('');
    console.log('🪄 LUMOS está completamente funcional y puede enviar notificaciones!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Error al enviar email:');
    console.error('');
    console.error('Mensaje:', error.message);
    console.error('');
    if (error.code === 'EAUTH') {
      console.error('⚠️  Error de autenticación. Verifica:');
      console.error('   1. Que EMAIL_USER sea correcto: azkabanreads@gmail.com');
      console.error('   2. Que EMAIL_PASS sea la contraseña de aplicación (no tu contraseña normal)');
      console.error('   3. Que la contraseña no tenga espacios extra al inicio o final');
    }
  }
}

testEmail();
