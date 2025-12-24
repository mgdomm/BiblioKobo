const nodemailer = require('nodemailer');

/**
 * Servicio de envío de correos electrónicos
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
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
      subject: 'Un libro capturado ahora está a tu alcance',
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
              font-family: 'MedievalSharp', cursive;
              background: #111;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #222;
              border-radius: 10px;
              border: 2px solid #19E6D6;
              box-shadow: 0 0 30px rgba(25, 230, 214, 0.3);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #19E6D6 0%, #0fb3a3 100%);
              color: #111;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-family: 'MedievalSharp', cursive;
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
              color: #fff;
            }
            p {
              line-height: 1.8;
              margin-bottom: 15px;
              color: #ddd;
              font-size: 15px;
            }
            .book-info {
              background: #333;
              padding: 25px;
              border-radius: 8px;
              border-left: 4px solid #19E6D6;
              margin: 25px 0;
            }
            .book-title {
              color: #19E6D6;
              font-size: 22px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .book-author {
              color: #aaa;
              font-style: italic;
              font-size: 16px;
            }
            .btn-container {
              text-align: center;
              margin: 30px 0;
            }
            .btn {
              display: inline-block;
              padding: 14px 30px;
              background: #19E6D6;
              color: #111;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              font-size: 16px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(25, 230, 214, 0.4);
            }
            .btn:hover {
              background: #0fb3a3;
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(25, 230, 214, 0.6);
            }
            .note {
              background: rgba(25, 230, 214, 0.1);
              border-left: 4px solid #19E6D6;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .note p {
              color: #19E6D6;
              margin: 0;
              font-size: 14px;
            }
            .footer {
              background: #1a1a1a;
              padding: 20px 30px;
              text-align: center;
              border-top: 2px solid #19E6D6;
            }
            .footer p {
              font-size: 12px;
              color: #888;
              margin: 5px 0;
            }
            .footer .brand {
              color: #19E6D6;
              font-weight: bold;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🪄 LIBRO CAPTURADO</h1>
              <p>Azkaban Reads - Notificación</p>
            </div>
            
            <div class="content">
              <p><strong>Desde los muros donde se confinan los libros...</strong></p>
              
              <p>Ha sido capturado y encerrado, retenido entre estas páginas hasta que alguien lo descubra.</p>
              
              <p>El libro que pediste ahora se encuentra bajo custodia en <strong>Azkaban Reads</strong> y solo tú puedes acceder a él.</p>
              
              <div class="book-info">
                <div class="book-title">${bookTitle}</div>
                <div class="book-author">${author}</div>
              </div>
              
              <div class="btn-container">
                <a href="${bookUrl}" class="btn">📥 ACCEDER AL LIBRO</a>
              </div>
              
              <div class="note">
                <p><strong>⚡ Importante:</strong> No pierdas tiempo. Lo que está capturado rara vez permanece disponible por mucho tiempo.</p>
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
              font-family: 'MedievalSharp', cursive;
              background: #111;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #222;
              border-radius: 10px;
              border: 2px solid #19E6D6;
              box-shadow: 0 0 30px rgba(25, 230, 214, 0.3);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #19E6D6 0%, #0fb3a3 100%);
              color: #111;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              font-family: 'MedievalSharp', cursive;
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
              color: #fff;
            }
            p {
              line-height: 1.8;
              margin-bottom: 15px;
              color: #ddd;
              font-size: 15px;
            }
            .success-box {
              background: rgba(25, 230, 214, 0.15);
              border-left: 4px solid #19E6D6;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .success-box p {
              color: #19E6D6;
              margin: 0;
              font-weight: bold;
            }
            .footer {
              background: #1a1a1a;
              padding: 20px 30px;
              text-align: center;
              border-top: 2px solid #19E6D6;
            }
            .footer p {
              font-size: 12px;
              color: #888;
              margin: 5px 0;
            }
            .footer .brand {
              color: #19E6D6;
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
              
              <p style="margin-top: 25px; font-style: italic; color: #aaa;">
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
}

module.exports = new EmailService();
