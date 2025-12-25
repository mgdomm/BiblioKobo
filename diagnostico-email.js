require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🔍 DIAGNÓSTICO DEL SISTEMA DE EMAIL\n');
console.log('='.repeat(60));

// 1. Verificar variables de entorno
console.log('\n1️⃣ Variables de entorno:');
console.log('   EMAIL_USER:', process.env.EMAIL_USER || '❌ No configurado');
console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Configurado (longitud: ' + process.env.EMAIL_PASS.length + ')' : '❌ No configurado');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('\n❌ ERROR: Las credenciales de email no están configuradas');
  console.log('   Configura EMAIL_USER y EMAIL_PASS en el archivo .env');
  process.exit(1);
}

// 2. Crear transporter
console.log('\n2️⃣ Creando transporter de nodemailer...');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000
});
console.log('   ✅ Transporter creado');

// 3. Verificar conexión
async function verificarConexion() {
  console.log('\n3️⃣ Verificando conexión con Gmail...');
  try {
    console.time('   Tiempo de verificación');
    await transporter.verify();
    console.timeEnd('   Tiempo de verificación');
    console.log('   ✅ Conexión exitosa con Gmail SMTP');
    return true;
  } catch (error) {
    console.timeEnd('   Tiempo de verificación');
    console.log('   ❌ Error de conexión:', error.message);
    console.log('   Código:', error.code);
    
    if (error.code === 'EAUTH') {
      console.log('\n   ⚠️  Error de autenticación:');
      console.log('      - Verifica que EMAIL_PASS sea la contraseña de aplicación de Google');
      console.log('      - NO uses tu contraseña normal de Gmail');
      console.log('      - Genera una nueva en: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.log('\n   ⚠️  Error de conexión:');
      console.log('      - Verifica tu conexión a internet');
      console.log('      - El firewall puede estar bloqueando el puerto 465/587');
      console.log('      - Algunos servidores bloquean conexiones SMTP salientes');
    }
    
    return false;
  }
}

// 4. Enviar email de prueba
async function enviarEmailPrueba() {
  console.log('\n4️⃣ Enviando email de prueba...');
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: 'azkabanreads@gmail.com',
    subject: '✅ Prueba de diagnóstico - BiblioKobo',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #19E6D6;">✅ Sistema de Email Funcionando</h1>
          <p>Este es un email de prueba del sistema de diagnóstico.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
          <p>Si recibes este email, significa que el sistema de notificaciones está funcionando correctamente.</p>
        </div>
      </div>
    `
  };
  
  try {
    console.time('   Tiempo de envío');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout - más de 15 segundos')), 15000)
    );
    
    const sendPromise = transporter.sendMail(mailOptions);
    await Promise.race([sendPromise, timeoutPromise]);
    
    console.timeEnd('   Tiempo de envío');
    console.log('   ✅ Email enviado exitosamente');
    console.log('   📧 Revisa la bandeja de azkabanreads@gmail.com');
    return true;
  } catch (error) {
    console.timeEnd('   Tiempo de envío');
    console.log('   ❌ Error enviando email:', error.message);
    console.log('   Código:', error.code);
    return false;
  }
}

// Ejecutar diagnóstico
(async () => {
  const conexionOK = await verificarConexion();
  
  if (conexionOK) {
    const envioOK = await enviarEmailPrueba();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:\n');
    console.log('   Variables configuradas: ✅');
    console.log('   Conexión Gmail:        ✅');
    console.log('   Envío de email:        ' + (envioOK ? '✅' : '❌'));
    
    if (envioOK) {
      console.log('\n🎉 TODO FUNCIONA CORRECTAMENTE');
      console.log('   El problema puede estar en:');
      console.log('   - El servidor de producción no tiene las variables .env configuradas');
      console.log('   - El servidor no está corriendo');
      console.log('   - Hay un problema de red en el servidor de producción');
    } else {
      console.log('\n⚠️  HAY PROBLEMAS CON EL ENVÍO');
      console.log('   Revisa los errores arriba para más detalles');
    }
    
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('\n❌ NO SE PUEDE CONECTAR A GMAIL');
    console.log('   El sistema de notificaciones NO funcionará');
    console.log('   Revisa los errores arriba para solucionar el problema');
  }
  
  console.log('\n');
})();
