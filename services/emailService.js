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
        <body bgcolor="#000000">
          <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000">
            <tr>
              <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#000000" style="border: 2px solid #00FFFF; border-radius: 12px;">
                  <tr>
                    <td bgcolor="#000000" style="border-bottom: 2px solid #00FFFF; padding: 20px; text-align: center;">
                      <h1 style="font-family: 'VT323', monospace; font-size: 24px; color: #00FFFF; margin: 0; letter-spacing: 2px;">🔗 SOLICITUD REGISTRADA</h1>
                      <p style="font-size: 12px; color: #00FFFF; opacity: 0.7; margin: 5px 0 0 0;">Azkaban Reads – Guardián LUMOS</p>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#000000" style="padding: 25px; color: #00FFFF;">
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;">Las sombras han tomado nota de tu petición. Tu solicitud ya está en los archivos de Azkaban Reads.</p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background: #0a0a0a !important; background-color: #0a0a0a !important; border: 3px solid #00FFFF; margin: 20px 0;">
                        <tr>
                          <td style="padding: 15px; background: #0a0a0a !important; background-color: #0a0a0a !important;">
                            <div style="font-size: 16px; color: #00FFFF; font-weight: bold; margin-bottom: 5px; font-family: 'VT323', monospace;">${bookTitle}</div>
                            <div style="font-size: 12px; color: #00FFFF; opacity: 0.8; font-style: italic; font-family: 'VT323', monospace;">${author}</div>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;">Cuando el libro sea capturado, enviaré un cuervo digital a esta dirección para avisarte.</p>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#000000" style="border-top: 2px solid #00FFFF; padding: 15px; text-align: center; font-size: 11px;">
                      <p style="color: #00FFFF; margin: 5px 0; font-family: 'VT323', monospace;">🪄 LUMOS – Guardián de Azkaban Reads</p>
                      <p style="color: #00FFFF; margin: 5px 0; font-family: 'VT323', monospace;">"Los libros permanecen capturados entre estos muros... y solo los elegidos pueden acceder a ellos."</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
          ${LUMOS_EMAIL_STYLE}
        </head>
        <body bgcolor="#000000">
          <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000">
            <tr>
              <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#000000" style="border: 2px solid #00FFFF; border-radius: 12px;">
                  <tr>
                    <td bgcolor="#000000" style="border-bottom: 2px solid #00FFFF; padding: 20px; text-align: center;">
                      <h1 style="font-family: 'VT323', monospace; font-size: 24px; color: #00FFFF; margin: 0; letter-spacing: 2px;">🔮 LIBRO CAPTURADO</h1>
                      <p style="font-size: 12px; color: #00FFFF; opacity: 0.7; margin: 5px 0 0 0;">Azkaban Reads – Guardián LUMOS</p>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#000000" style="padding: 25px; color: #00FFFF;">
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;">Este libro ha sido capturado y encerrado entre estas páginas oscuras. Permanecía oculto, pero ahora ha sido traído a la luz para ti.</p>
                      
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;">LUMOS te notifica que <strong style="color: #00FFFF;">${bookTitle}</strong> de <strong style="color: #00FFFF;">${author}</strong> está ahora disponible para su liberación.</p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background: #0a0a0a !important; background-color: #0a0a0a !important; border: 3px solid #00FFFF; margin: 20px 0;">
                        <tr>
                          <td style="padding: 15px; background: #0a0a0a !important; background-color: #0a0a0a !important;">
                            <div style="font-size: 16px; color: #00FFFF; font-weight: bold; margin-bottom: 5px; font-family: 'VT323', monospace;">${bookTitle}</div>
                            <div style="font-size: 12px; color: #00FFFF; opacity: 0.8; font-style: italic; font-family: 'VT323', monospace;">${author}</div>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;">Los muros de Azkaban Reads protegen este conocimiento. Solo los elegidos pueden acceder a él.</p>
                      
                      <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                        <tr>
                          <td bgcolor="#000000" style="border: 2px solid #00FFFF; border-radius: 6px; padding: 10px 20px;">
                            <a href="${bookUrl}" style="font-family: 'VT323', monospace; text-decoration: none; color: #00FFFF; font-weight: bold; font-size: 14px;">🔓 LIBERAR EL LIBRO</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#000000" style="border-top: 2px solid #00FFFF; padding: 15px; text-align: center; font-size: 11px;">
                      <p style="color: #00FFFF; margin: 5px 0; font-family: 'VT323', monospace;">🪄 LUMOS – Asistente de Azkaban Reads</p>
                      <p style="color: #00FFFF; margin: 5px 0; font-family: 'VT323', monospace;">"Los libros permanecen capturados entre estos muros... y solo los elegidos pueden acceder a ellos."</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
      subject: '🔗 Nueva solicitud - Azkaban Reads',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${LUMOS_EMAIL_STYLE}
        </head>
        <body bgcolor="#000000">
          <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000">
            <tr>
              <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" bgcolor="#000000" style="border: 2px solid #00FFFF; border-radius: 12px;">
                  <tr>
                    <td bgcolor="#000000" style="border-bottom: 2px solid #00FFFF; padding: 20px; text-align: center;">
                      <h1 style="font-family: 'VT323', monospace; font-size: 24px; color: #00FFFF; margin: 0; letter-spacing: 2px;">🔗 SOLICITUD RECIBIDA</h1>
                      <p style="font-size: 12px; color: #00FFFF; opacity: 0.7; margin: 5px 0 0 0;">Azkaban Reads – Sistema de Notificaciones</p>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#000000" style="padding: 25px; color: #00FFFF;">
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;">Un prisionero ha clamado entre los muros. Su voz resuena en la oscuridad, pidiendo un libro que aún no ha sido capturado.</p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background: #0a0a0a !important; background-color: #0a0a0a !important; border: 3px solid #00FFFF; margin: 20px 0;">
                        <tr>
                          <td style="padding: 15px; background: #0a0a0a !important; background-color: #0a0a0a !important;">
                            <div style="font-size: 16px; color: #00FFFF; font-weight: bold; margin-bottom: 5px; font-family: 'VT323', monospace;">${bookTitle}</div>
                            <div style="font-size: 12px; color: #00FFFF; opacity: 0.8; font-style: italic; font-family: 'VT323', monospace;">${author}</div>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="line-height: 1.6; margin-bottom: 15px; color: #00FFFF; font-size: 14px; font-family: 'VT323', monospace;"><strong style="color: #00FFFF;">Solicitante:</strong> ${userEmail}</p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background: #0a0a0a !important; background-color: #0a0a0a !important; border-left: 3px solid #00FFFF; margin: 20px 0;">
                        <tr>
                          <td style="padding: 12px 15px; background: #0a0a0a !important; background-color: #0a0a0a !important;">
                            <p style="margin: 0; font-size: 13px; color: #00FFFF; font-family: 'VT323', monospace;">⚡ Acción: Captura este libro y libera al prisionero de su espera.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#000000" style="border-top: 2px solid #00FFFF; padding: 15px; text-align: center; font-size: 11px;">
                      <p style="color: #00FFFF; margin: 5px 0; font-family: 'VT323', monospace;">🪄 LUMOS – Sistema de Azkaban Reads</p>
                      <p style="color: #00FFFF; margin: 5px 0; font-family: 'VT323', monospace;">"Las voces de los que esperan... nunca dejan de resonar en estos muros."</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
