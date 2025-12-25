const nodemailer = require('nodemailer');

/**
 * Servicio de envío de correos electrónicos
 */
class EmailService {
  constructor() {
    // Validar que las credenciales estén configuradas
    console.log('🔧 Inicializando EmailService...');
    console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Configurado: ' + process.env.EMAIL_USER : '❌ NO configurado');
    console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Configurado (oculto)' : '❌ NO configurado');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ ERROR CRÍTICO: Credenciales de email no configuradas');
      console.error('   Verifica que EMAIL_USER y EMAIL_PASS estén en Render Environment Variables');
      process.exit(1); // Detener el servidor si faltan credenciales
    }
    
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Configuración de timeouts para evitar esperas largas
      connectionTimeout: 10000, // 10 segundos
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    console.log('✅ EmailService inicializado correctamente');
  }

  /**
   * Envía confirmación al usuario de que su solicitud fue registrada
   * @param {string} email - Correo del usuario solicitante
   * @param {string} bookTitle - Título del libro solicitado
   * @param {string} author - Autor del libro solicitado
   */
  async sendBookRequestConfirmation(email, bookTitle, author) {
    console.log(`📧 [CONFIRMATION] Enviando confirmación a ${email} para "${bookTitle}" de ${author}`);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '📜 Tu solicitud ha sido registrada en Azkaban Reads',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #111 !important; color: #eee !important; font-family: 'MedievalSharp', Georgia, serif; padding: 24px; }
            .card { max-width: 640px; margin: 0 auto; background: #1c1c1c !important; border: 2px solid #19E6D6; border-radius: 10px; box-shadow: 0 0 24px rgba(25,230,214,0.3); overflow: hidden; }
            .header { background: linear-gradient(135deg, #19E6D6 0%, #0fb3a3 100%) !important; color: #0c0c0c !important; padding: 24px; text-align: center; }
            .title { font-size: 24px; margin: 0; font-weight: bold; }
            .subtitle { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
            .content { padding: 24px; }
            p { line-height: 1.7; margin: 0 0 14px; color: #e6e6e6 !important; }
            .book { background: #252525 !important; border-left: 4px solid #19E6D6; padding: 16px; border-radius: 8px; margin: 18px 0; }
            .book-title { color: #19E6D6 !important; font-weight: 700; font-size: 18px; }
            .book-author { color: #b5b5b5 !important; font-style: italic; margin-top: 4px; }
            .footer { padding: 16px 24px 22px; border-top: 1px solid rgba(25,230,214,0.25); color: #9a9a9a !important; font-size: 12px; text-align: center; background: #141414 !important; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <p class="title">🔗 Solicitud registrada</p>
              <p class="subtitle">Azkaban Reads – Confirmación</p>
            </div>
            <div class="content">
              <p>Las sombras han tomado nota de tu petición. Tu solicitud ya está en los archivos de Azkaban Reads.</p>
              <div class="book">
                <div class="book-title">${bookTitle}</div>
                <div class="book-author">${author}</div>
              </div>
              <p>Cuando el libro sea capturado, enviaré un cuervo digital a esta dirección para avisarte. Si no lo ves, revisa la carpeta de spam.</p>
            </div>
            <div class="footer">
              <p>🪄 LUMOS – Guardián de Azkaban Reads</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      console.log(`   Enviando desde: ${process.env.EMAIL_USER}`);
      console.log(`   Enviando a: ${email}`);
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ [CONFIRMATION] Email enviado exitosamente. ID: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`❌ [CONFIRMATION] Error enviando confirmación a ${email}:`, error.message);
      console.error('   Código de error:', error.code);
      console.error('   Stack:', error.stack);
      return false;
    }
  }

  /**
   * Envía un correo cuando un libro solicitado está disponible
   * @param {string} email - Correo del destinatario
   * @param {string} bookTitle - Título del libro
   * @param {string} author - Autor del libro
   * @param {string} bookUrl - URL del libro en la página
   */
  async sendBookCapturedEmail(email, bookTitle, author, bookUrl) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '📜 Un libro ha sido capturado en Azkaban Reads',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'MedievalSharp', Georgia, serif !important;
              background: #111 !important;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #222 !important;
              border-radius: 10px;
              border: 2px solid #19E6D6;
              box-shadow: 0 0 30px rgba(25, 230, 214, 0.3);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #19E6D6 0%, #0fb3a3 100%) !important;
              color: #111 !important;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-family: 'MedievalSharp', Georgia, serif !important;
              font-size: 28px;
              margin-bottom: 10px;
              font-weight: bold;
              color: #111 !important;
            }
            .header p {
              font-size: 14px;
              opacity: 0.8;
              color: #111 !important;
            }
            .content {
              padding: 30px;
              color: #fff !important;
              background: #222 !important;
            }
            p {
              line-height: 1.8;
              margin-bottom: 15px;
              color: #ddd !important;
              font-size: 15px;
              font-family: 'MedievalSharp', Georgia, serif !important;
            }
            .book-info {
              background: #333 !important;
              padding: 25px;
              border-radius: 8px;
              border-left: 4px solid #19E6D6;
              margin: 25px 0;
            }
            .book-title {
              color: #19E6D6 !important;
              font-size: 22px;
              font-weight: bold;
              margin-bottom: 8px;
              font-family: 'MedievalSharp', Georgia, serif !important;
            }
            .book-author {
              color: #aaa !important;
              font-style: italic;
              font-size: 16px;
              font-family: 'MedievalSharp', Georgia, serif !important;
            }
            .btn-container {
              text-align: center;
              margin: 30px 0;
            }
            .btn {
              display: inline-block;
              padding: 14px 30px;
              background: #19E6D6 !important;
              color: #111 !important;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(25, 230, 214, 0.4);
            }
            .btn:hover {
              background: #0fb3a3 !important;
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(25, 230, 214, 0.6);
            }
            .note {
              background: rgba(25, 230, 214, 0.1) !important;
              border-left: 4px solid #19E6D6;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .note p {
              color: #19E6D6 !important;
              margin: 0;
              font-size: 14px;
            }
            .footer {
              background: #1a1a1a !important;
              padding: 20px 30px;
              text-align: center;
              border-top: 2px solid #19E6D6;
            }
            .footer p {
              font-size: 12px;
              color: #888 !important;
              margin: 5px 0;
            }
            .footer .brand {
              color: #19E6D6 !important;
              font-weight: bold;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔮 LIBRO CAPTURADO</h1>
              <p>Mensaje del Guardián</p>
            </div>
            
            <div class="content">
              <p><strong>Desde las sombras de Azkaban...</strong></p>
              
              <p>Este libro ha sido capturado y encerrado entre estas páginas oscuras. Permanecía oculto, pero ahora ha sido traído a la luz para ti.</p>
              
              <p>LUMOS, el guardián de estas obras prohibidas, te notifica que <strong>"${bookTitle}"</strong> de <strong>${author}</strong> está ahora disponible para su liberación.</p>
              
              <div class="book-info">
                <div class="book-title">${bookTitle}</div>
                <div class="book-author">${author}</div>
              </div>
              
              <p>Los muros de Azkaban Reads protegen este conocimiento. Solo los elegidos pueden acceder a él.</p>
              
              <div class="btn-container">
                <a href="${bookUrl}" class="btn">🔓 LIBERAR EL LIBRO</a>
              </div>
              
              <div class="note">
                <p><strong>⚠️ Advertencia:</strong> Lo que está capturado no permanece disponible eternamente. Accede pronto antes de que las sombras lo reclamen de nuevo.</p>
              </div>
            </div>
            
            <div class="footer">
              <p class="brand">🪄 LUMOS – Asistente de Azkaban Reads</p>
              <p>"Los libros permanecen capturados entre estos muros… y solo los elegidos pueden acceder a ellos."</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Correo enviado a ${email} para el libro: ${bookTitle}`);
      return true;
    } catch (error) {
      console.error('Error enviando correo:', error);
      return false;
    }
  }

  /**
   * Envía un correo de confirmación de suscripción a novedades
   * @param {string} email - Correo del destinatario
   * @param {string} notificationType - Tipo de notificación
   */
  async sendSubscriptionConfirmation(email, notificationType) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Vigilancia activada en Azkaban Reads',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'MedievalSharp', Georgia, serif;
              background: #111 !important;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #222 !important;
              border-radius: 10px;
              border: 2px solid #19E6D6;
              box-shadow: 0 0 30px rgba(25, 230, 214, 0.3);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #19E6D6 0%, #0fb3a3 100%) !important;
              color: #111 !important;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-family: 'MedievalSharp', Georgia, serif;
              font-size: 28px;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .header p {
              font-size: 14px;
              opacity: 0.8;
            }
            .content {
              padding: 30px;
              color: #fff !important;
            }
            p {
              line-height: 1.8;
              margin-bottom: 15px;
              color: #ddd !important;
              font-size: 15px;
            }
            .success-box {
              background: rgba(25, 230, 214, 0.15) !important;
              border-left: 4px solid #19E6D6;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .success-box p {
              color: #19E6D6 !important;
              margin: 0;
              font-weight: bold;
            }
            .footer {
              background: #1a1a1a !important;
              padding: 20px 30px;
              text-align: center;
              border-top: 2px solid #19E6D6;
            }
            .footer p {
              font-size: 12px;
              color: #888 !important;
              margin: 5px 0;
            }
            .footer .brand {
              color: #19E6D6 !important;
              font-weight: bold;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 VIGILANCIA ACTIVADA</h1>
              <p>Azkaban Reads - Confirmación</p>
            </div>
            
            <div class="content">
              <p><strong>Estaré atento desde las sombras...</strong></p>
              
              <div class="success-box">
                <p>✅ Tu solicitud de vigilancia ha sido registrada exitosamente.</p>
              </div>
              
              <p>Desde ahora, estaré atento a cada libro que sea capturado y encerrado en <strong>Azkaban Reads</strong>. Cuando algo de tu interés atraviese estos muros, serás el primero en saberlo.</p>
              
              <p style="margin-top: 25px; font-style: italic; color: #aaa !important;">
                Incluso desde los muros donde los libros permanecen capturados, nada escapa a mi vigilancia.
              </p>
            </div>
            
            <div class="footer">
              <p class="brand">🪄 LUMOS – Asistente de Azkaban Reads</p>
              <p>"Los libros permanecen capturados entre estos muros… y solo los elegidos pueden acceder a ellos."</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Correo de suscripción enviado a ${email}`);
      return true;
    } catch (error) {
      console.error('Error enviando correo de suscripción:', error);
      return false;
    }
  }

  /**
   * Envía un correo al admin cuando un usuario solicita un libro
   * @param {string} userEmail - Correo del usuario que solicita
   * @param {string} bookTitle - Título del libro solicitado
   * @param {string} author - Autor del libro solicitado
   */
  async sendBookRequestNotificationToAdmin(userEmail, bookTitle, author) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'azkabanreads@gmail.com',
      subject: '🔗 Nueva solicitud de un prisionero - Azkaban Reads',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'MedievalSharp', Georgia, serif;
              background: #111 !important;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #222 !important;
              border-radius: 10px;
              border: 2px solid #19E6D6;
              box-shadow: 0 0 30px rgba(25, 230, 214, 0.3);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #19E6D6 0%, #0fb3a3 100%) !important;
              color: #111 !important;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-family: 'MedievalSharp', Georgia, serif;
              font-size: 28px;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .header p {
              font-size: 14px;
              opacity: 0.8;
            }
            .content {
              padding: 30px;
              color: #fff !important;
            }
            p {
              line-height: 1.8;
              margin-bottom: 15px;
              color: #ddd !important;
              font-size: 15px;
            }
            .request-info {
              background: #333 !important;
              padding: 25px;
              border-radius: 8px;
              border-left: 4px solid #19E6D6;
              margin: 25px 0;
            }
            .book-title {
              color: #19E6D6 !important;
              font-size: 22px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .book-author {
              color: #aaa !important;
              font-style: italic;
              font-size: 16px;
              margin-bottom: 12px;
            }
            .requester-email {
              color: #19E6D6 !important;
              font-size: 14px;
              background: rgba(25, 230, 214, 0.1) !important;
              padding: 8px 12px;
              border-radius: 4px;
              display: inline-block;
              margin-top: 10px;
            }
            .note {
              background: rgba(25, 230, 214, 0.1) !important;
              border-left: 4px solid #19E6D6;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .note p {
              color: #19E6D6 !important;
              margin: 0;
              font-size: 14px;
            }
            .footer {
              background: #1a1a1a !important;
              padding: 20px 30px;
              text-align: center;
              border-top: 2px solid #19E6D6;
            }
            .footer p {
              font-size: 12px;
              color: #888 !important;
              margin: 5px 0;
            }
            .footer .brand {
              color: #19E6D6 !important;
              font-weight: bold;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔗 SOLICITUD DESDE AZKABAN</h1>
              <p>Notificación del Sistema</p>
            </div>
            
            <div class="content">
              <p><strong>Desde las celdas donde los lectores aguardan...</strong></p>
              
              <p>Un prisionero ha clamado entre los muros. Su voz resuena en la oscuridad, pidiendo un libro que aún no ha sido capturado.</p>
              
              <p>La desesperación por leer es palpable. Las cadenas de la espera pesan sobre él, y solo tú puedes liberarlo trayendo este libro a Azkaban Reads.</p>
              
              <div class="request-info">
                <div class="book-title">${bookTitle}</div>
                <div class="book-author">${author}</div>
                <div class="requester-email">📧 ${userEmail}</div>
              </div>
              
              <div class="note">
                <p><strong>⚡ Acción requerida:</strong> Captura este libro y libera al prisionero de su espera.</p>
              </div>
              
              <p style="margin-top: 25px; font-style: italic; color: #aaa !important;">
                "Las voces de los que esperan... nunca dejan de resonar en estos muros."
              </p>
            </div>
            
            <div class="footer">
              <p class="brand">🪄 Sistema de Notificaciones - Azkaban Reads</p>
              <p>"Los libros permanecen capturados entre estos muros… y solo los elegidos pueden acceder a ellos."</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      // Timeout de 15 segundos para evitar esperas largas
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout al enviar email')), 15000)
      );
      
      const sendPromise = this.transporter.sendMail(mailOptions);
      
      await Promise.race([sendPromise, timeoutPromise]);
      
      console.log(`Notificación de solicitud enviada al admin para: ${bookTitle}`);
      return true;
    } catch (error) {
      console.error('Error enviando notificación al admin:', error);
      console.error('Tipo de error:', error.code || error.message);
      return false;
    }
  }
}

module.exports = new EmailService();
