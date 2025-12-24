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
      const requests = await FileHandler.readJSON(this.requestsPath);
      const pendingRequests = requests.filter(req => req.status === 'pending');

      for (const request of pendingRequests) {
        // Buscar coincidencias por título (case-insensitive)
        const titleMatch = book.title.toLowerCase().includes(request.title.toLowerCase()) ||
                          request.title.toLowerCase().includes(book.title.toLowerCase());
        
        const authorMatch = book.author.toLowerCase().includes(request.author.toLowerCase()) ||
                           request.author.toLowerCase().includes(book.author.toLowerCase());

        if (titleMatch && authorMatch) {
          // Enviar email
          const bookUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/libros#${book.id}`;
          await emailService.sendBookCapturedEmail(
            request.email,
            book.title,
            book.author,
            bookUrl
          );

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
      const notifications = await FileHandler.readJSON(this.notificationsPath);

      for (const notification of notifications) {
        let shouldNotify = false;

        switch (notification.type) {
          case 'all':
            shouldNotify = true;
            break;
          
          case 'author':
            if (notification.filters.author && 
                book.author.toLowerCase().includes(notification.filters.author.toLowerCase())) {
              shouldNotify = true;
            }
            break;
          
          case 'saga':
            if (notification.filters.saga && book.saga && 
                book.saga.name.toLowerCase().includes(notification.filters.saga.toLowerCase())) {
              shouldNotify = true;
            }
            break;
        }

        if (shouldNotify) {
          const bookUrl = `${process.env.SITE_URL || 'http://localhost:3000'}/libros#${book.id}`;
          await emailService.sendBookCapturedEmail(
            notification.email,
            book.title,
            book.author,
            bookUrl
          );
        }
      }
    } catch (error) {
      console.error('Error notificando suscriptores:', error);
    }
  }
}

module.exports = new NotificationService();
