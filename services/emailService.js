const sgMail = require('@sendgrid/mail');

/**
 * Template CSS para todos los emails (estilo LUMOS)
 */
const LUMOS_EMAIL_STYLE = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'VT323', 'Courier New', monospace;
      background: #000 !important;
      color: #00FFFF !important;
      padding: 20px;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #000 !important;
      border: 2px solid #00FFFF;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 0 20px rgba(0,255,255,0.3);
    }
    
    .header {
      background: #000 !important;
      border-bottom: 2px solid #00FFFF;
      padding: 20px;
      text-align: center;
    }
    
    .header h1 {
      font-family: 'VT323', 'Courier New', monospace;
      font-size: 24px;
      color: #00FFFF !important;
      margin-bottom: 5px;
      letter-spacing: 2px;
    }
    
    .header p {
      font-size: 12px;
      color: #00FFFF !important;
      opacity: 0.7;
      margin: 0;
    }
    
    .content {
      padding: 25px;
      color: #00FFFF !important;
    }
    
    .content p {
      line-height: 1.6;
      margin-bottom: 15px;
      color: #00FFFF !important;
      font-size: 14px;
    }
    
    .content strong {
      color: #00FFFF !important;
      font-weight: bold;
    }
    
    .book-info {
      background: #0a0a0a !important;
      border: 1px solid #00FFFF;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }
    
    .book-title {
      font-size: 16px;
      color: #00FFFF !important;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .book-author {
      font-size: 12px;
      color: #00FFFF !important;
      opacity: 0.8;
      font-style: italic;
    }
    
    .alert-box {
      background: #0a0a0a !important;
      border-left: 3px solid #00FFFF;
      padding: 12px 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    
    .alert-box p {
      margin: 0;
      font-size: 13px;
      color: #00FFFF !important;
    }
    
    .button {
      display: inline-block;
      background: #000 !important;
      border: 2px solid #00FFFF;
      color: #00FFFF !important;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      margin: 20px 0;
      transition: all 0.3s;
    }
    
    .button:hover {
      background: #00FFFF !important;
      color: #000 !important;
    }
    
    .footer {
      background: #000 !important;
      border-top: 2px solid #00FFFF;
      padding: 15px;
      text-align: center;
      font-size: 11px;
    }
    
    .footer p {
      color: #00FFFF !important;
      margin: 5px 0;
    }
  </style>
`;

/**
 * Servicio de envío de correos electrónicos usando SendGrid API REST
 * (No usa SMTP, evita bloqueos de firewall en Render)
 */
class EmailService {
  constructor() {
    // Validar que las credenciales estén configuradas
    console.log('🔧 Inicializando EmailService con SendGrid API REST...');
    console.log('   SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Configurado' : '❌ NO configurado');
    console.log('   EMAIL_FROM:', process.env.EMAIL_FROM ? '✅ Configurado: ' + process.env.EMAIL_FROM : '❌ NO configurado');
    
    if (!process.env.SENDGRID_API_KEY || !process.env.EMAIL_FROM) {
      console.error('❌ ERROR CRÍTICO: SendGrid no configurado');
      console.error('   Verifica que SENDGRID_API_KEY y EMAIL_FROM estén en Render Environment Variables');
      process.exit(1);
    }
    
    // Configurar SDK de SendGrid (usa API REST, no SMTP)
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.sendgrid = sgMail;
    this.fromEmail = process.env.EMAIL_FROM;

    console.log('✅ EmailService inicializado con SendGrid API REST (sin SMTP)');
  }

  /**
   * Envía confirmación al usuario de que su solicitud fue registrada
   * @param {string} email - Correo del usuario solicitante
   * @param {string} bookTitle - Título del libro solicitado
   * @param {string} author - Autor del libro solicitado
   */
  async sendBookRequestConfirmation(email, bookTitle, author) {
    console.log(`📧 [CONFIRMATION] Enviando confirmación a ${email} para "${bookTitle}" de ${author}`);
    
    const mailContent = {
      to: email,
      from: this.fromEmail,
      subject: '📜 Tu solicitud ha sido registrada en Azkaban Reads',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${LUMOS_EMAIL_STYLE}
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔗 SOLICITUD REGISTRADA</h1>
              <p>Azkaban Reads – Guardián LUMOS</p>
            </div>
            
            <div class="content">
              <p>Las sombras han tomado nota de tu petición. Tu solicitud ya está en los archivos de Azkaban Reads.</p>
              
              <div class="book-info">
                <div class="book-title">${bookTitle}</div>
                <div class="book-author">${author}</div>
              </div>
              
              <p>Cuando el libro sea capturado, enviaré un cuervo digital a esta dirección para avisarte.</p>
              
              <div class="alert-box">
                <p>⚠️ Si no ves el email en tu bandeja de entrada, revisa la carpeta de <strong>spam</strong>.</p>
              </div>
            </div>
            
            <div class="footer">
              <p>🪄 LUMOS – Guardián de Azkaban Reads</p>
              <p>"Los libros permanecen capturados entre estos muros... y solo los elegidos pueden acceder a ellos."</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      console.log(`   Enviando desde: ${this.fromEmail}`);
      console.log(`   Enviando a: ${email}`);
      const response = await this.sendgrid.send(mailContent);
      console.log(`✅ [CONFIRMATION] Email enviado exitosamente. ID: ${response[0].headers['x-message-id']}`);
      return true;
    } catch (error) {
      console.error(`❌ [CONFIRMATION] Error enviando confirmación a ${email}:`, error.message);
      console.error('   Código de error:', error.code);
      console.error('   Respuesta:', error.response?.body?.errors);
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
    const mailContent = {
      from: this.fromEmail,
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
      const response = await this.sendgrid.send(mailContent);
      console.log(`📖 [CAPTURED] Correo de libro capturado enviado a ${email}. ID: ${response[0].headers['x-message-id']}`);
      return true;
    } catch (error) {
      console.error(`❌ [CAPTURED] Error enviando correo a ${email}:`, error.message);
      return false;
    }
  }

  /**
   * Envía un correo de confirmación de suscripción a novedades
   * @param {string} email - Correo del destinatario
   * @param {string} notificationType - Tipo de notificación
   */
  async sendSubscriptionConfirmation(email, notificationType) {
    const mailContent = {
      from: this.fromEmail,
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
      const response = await this.sendgrid.send(mailContent);
      console.log(`📬 [SUBSCRIPTION] Correo de vigilancia enviado a ${email}. ID: ${response[0].headers['x-message-id']}`);
      return true;
    } catch (error) {
      console.error(`❌ [SUBSCRIPTION] Error enviando correo de suscripción a ${email}:`, error.message);
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
    const mailContent = {
      from: this.fromEmail,
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
      console.log(`📬 [ADMIN] Enviando notificación para solicitud: ${bookTitle}`);
      const response = await this.sendgrid.send(mailContent);
      console.log(`✅ [ADMIN] Notificación enviada al admin. ID: ${response[0].headers['x-message-id']}`);
      return true;
    } catch (error) {
      console.error(`❌ [ADMIN] Error enviando notificación:`, error.message);
      console.error('   Respuesta del error:', error.response?.body?.errors);
      return false;
    }
  }
}

module.exports = new EmailService();
