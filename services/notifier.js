const FileHandler = require('../utils/fileHandler');
const emailService = require('./emailService');
const path = require('path');

/**
 * Servicio de notificaciones
 */
class NotificationService {
  constructor() {
    this.requestsPath = path.join(__dirname, '../data/requests.json');
    this.notificationsPath = path.join(__dirname, '../data/notifications.json');
    this.booksPath = path.join(__dirname, '../books.json');
  }

  /**
   * Verifica si un nuevo libro coincide con solicitudes pendientes
   * @param {object} book - Libro añadido
   */
  async checkPendingRequests(book) {
    try {
      console.log('🔍 Verificando solicitudes pendientes para:', book.title, 'por', book.author);
      const requests = await FileHandler.readJSON(this.requestsPath);
      const pendingRequests = requests.filter(req => req.status === 'pending');
      
      console.log(`📋 Total de solicitudes pendientes: ${pendingRequests.length}`);

      for (const request of pendingRequests) {
        console.log(`Comparando con solicitud: "${request.title}" por "${request.author}"`);
        
        // Buscar coincidencias por título (case-insensitive)
        const titleMatch = book.title.toLowerCase().includes(request.title.toLowerCase()) ||
                          request.title.toLowerCase().includes(book.title.toLowerCase());
        
        const authorMatch = book.author.toLowerCase().includes(request.author.toLowerCase()) ||
                           request.author.toLowerCase().includes(book.author.toLowerCase());

        console.log(`  - Título coincide: ${titleMatch}, Autor coincide: ${authorMatch}`);

        if (titleMatch && authorMatch) {
          console.log(`✅ COINCIDENCIA encontrada! Enviando email a ${request.email}`);
          
          // Enviar email
          const bookUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/libros#${book.id}`;
          const emailSent = await emailService.sendBookCapturedEmail(
            request.email,
            book.title,
            book.author,
            bookUrl
          );

          if (emailSent) {
            console.log(`📧 Email enviado exitosamente a ${request.email}`);
          } else {
            console.log(`⚠️ No se pudo enviar el email a ${request.email}`);
          }

          // Actualizar estado de la solicitud
          await FileHandler.updateInJSON(
            this.requestsPath,
            req => req.id === request.id,
            { status: 'notified', notifiedAt: new Date().toISOString() }
          );

          console.log(`Notificación enviada para: ${book.title} a ${request.email}`);
        }
      }
    } catch (error) {
      console.error('Error verificando solicitudes pendientes:', error);
    }
  }

  /**
   * Registra una suscripción a novedades
   * @param {string} email - Email del usuario
   * @param {string} type - Tipo de notificación
   * @param {object} filters - Filtros adicionales (autor, saga, etc.)
   */
  async subscribeToNotifications(email, type, filters = {}) {
    try {
      const notifications = await FileHandler.readJSON(this.notificationsPath);
      
      // Verificar si ya existe la suscripción
      const existingIndex = notifications.findIndex(
        n => n.email === email && n.type === type && 
        JSON.stringify(n.filters) === JSON.stringify(filters)
      );

      if (existingIndex === -1) {
        const newNotification = {
          id: `notif_${Date.now()}`,
          email,
          type,
          filters,
          createdAt: new Date().toISOString()
        };

        await FileHandler.addToJSON(this.notificationsPath, newNotification);
        
        // Enviar email de confirmación
        await emailService.sendSubscriptionConfirmation(email, type);
        
        return { success: true, message: 'Suscripción registrada' };
      }

      return { success: true, message: 'Ya estás suscrito a este tipo de notificaciones' };
    } catch (error) {
      console.error('Error registrando suscripción:', error);
      return { success: false, message: 'Error al procesar la suscripción' };
    }
  }

  /**
   * Envía notificaciones a usuarios suscritos cuando se añade un nuevo libro
   * @param {object} book - Libro añadido
   */
  async notifySubscribers(book) {
    try {
      console.log('📢 Verificando suscriptores de novedades para:', book.title);
      const notifications = await FileHandler.readJSON(this.notificationsPath);
      console.log(`📋 Total de suscripciones activas: ${notifications.length}`);

      for (const notification of notifications) {
        let shouldNotify = false;

        switch (notification.type) {
          case 'all':
            console.log(`  - Suscriptor "todos los libros": ${notification.email}`);
            shouldNotify = true;
            break;
          
          case 'author':
            if (notification.filters.author && 
                book.author.toLowerCase().includes(notification.filters.author.toLowerCase())) {
              console.log(`  - Coincidencia por autor "${notification.filters.author}": ${notification.email}`);
              shouldNotify = true;
            }
            break;
          
          case 'saga':
            if (notification.filters.saga && book.saga && 
                book.saga.name.toLowerCase().includes(notification.filters.saga.toLowerCase())) {
              console.log(`  - Coincidencia por saga "${notification.filters.saga}": ${notification.email}`);
              shouldNotify = true;
            }
            break;
        }

        if (shouldNotify) {
          console.log(`✅ Enviando notificación de novedad a ${notification.email}`);
          const bookUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/libros#${book.id}`;
          const emailSent = await emailService.sendBookCapturedEmail(
            notification.email,
            book.title,
            book.author,
            bookUrl
          );
          
          if (emailSent) {
            console.log(`📧 Email de novedad enviado a ${notification.email}`);
          } else {
            console.log(`⚠️ No se pudo enviar email a ${notification.email}`);
          }
        }
      }
    } catch (error) {
      console.error('Error notificando suscriptores:', error);
    }
  }
}

module.exports = new NotificationService();
