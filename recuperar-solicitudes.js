require('dotenv').config();
const emailService = require('./services/emailService');
const FileHandler = require('./utils/fileHandler');
const path = require('path');

const requestsPath = path.join(__dirname, 'data/requests.json');

async function recuperarSolicitudes() {
  console.log('📧 Recuperando solicitudes sin notificación al admin...\n');
  console.log('='.repeat(60));
  
  try {
    // Leer todas las solicitudes
    const requests = await FileHandler.readJSON(requestsPath);
    console.log(`\n📊 Total de solicitudes en el sistema: ${requests.length}`);
    
    // Filtrar solicitudes pendientes
    const pending = requests.filter(r => r.status === 'pending');
    console.log(`⏳ Solicitudes pendientes: ${pending.length}`);
    
    if (pending.length === 0) {
      console.log('\n✅ No hay solicitudes pendientes para procesar');
      return;
    }
    
    console.log('\n📋 Lista de solicitudes pendientes:');
    console.log('='.repeat(60));
    
    pending.forEach((req, index) => {
      console.log(`\n${index + 1}. ${req.title}`);
      console.log(`   Autor: ${req.author}`);
      console.log(`   Email: ${req.email}`);
      console.log(`   Fecha: ${new Date(req.createdAt).toLocaleString('es-ES')}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🔄 Reenviando notificaciones al admin...\n');
    
    let enviados = 0;
    let fallidos = 0;
    
    for (const req of pending) {
      try {
        console.log(`📨 Enviando: "${req.title}" de ${req.author}...`);
        
        const result = await emailService.sendBookRequestNotificationToAdmin(
          req.email,
          req.title,
          req.author
        );
        
        if (result) {
          console.log(`   ✅ Enviado correctamente`);
          enviados++;
        } else {
          console.log(`   ⚠️  No se pudo enviar`);
          fallidos++;
        }
        
        // Esperar 1 segundo entre emails para no saturar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        fallidos++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RESUMEN:\n');
    console.log(`   Total procesadas: ${pending.length}`);
    console.log(`   ✅ Enviadas: ${enviados}`);
    console.log(`   ❌ Fallidas: ${fallidos}`);
    
    if (enviados > 0) {
      console.log('\n📧 Revisa tu email en azkabanreads@gmail.com');
      console.log('   Deberías tener ' + enviados + ' notificación(es) de solicitud');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error al recuperar solicitudes:', error);
  }
}

recuperarSolicitudes();
