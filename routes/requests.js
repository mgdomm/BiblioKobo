const express = require('express');
const router = express.Router();
const FileHandler = require('../utils/fileHandler');
const notifier = require('../services/notifier');
const emailService = require('../services/emailService');
const path = require('path');

const requestsPath = path.join(__dirname, '../data/requests.json');

/**
 * POST /api/requests/book
 * Registra una solicitud de libro
 */
router.post('/book', async (req, res) => {
  try {
    const { title, author, email } = req.body;

    // Validaciones
    if (!title || !author || !email) {
      return res.status(400).json({
        success: false,
        message: 'Necesito el título, autor y tu correo para registrar la solicitud.'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El correo proporcionado no parece válido.'
      });
    }

    const requests = await FileHandler.readJSON(requestsPath);

    // Verificar si ya existe una solicitud similar pendiente
    const existingRequest = requests.find(req => 
      req.title.toLowerCase() === title.toLowerCase() &&
      req.author.toLowerCase() === author.toLowerCase() &&
      req.email.toLowerCase() === email.toLowerCase() &&
      req.status === 'pending'
    );

    if (existingRequest) {
      return res.json({
        success: true,
        message: 'Ya habías solicitado este libro. Serás notificado cuando esté disponible.',
        alreadyExists: true
      });
    }

    // Crear nueva solicitud
    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title.trim(),
      author: author.trim(),
      email: email.toLowerCase().trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await FileHandler.addToJSON(requestsPath, newRequest);

    // Enviar notificación al admin
    await emailService.sendBookRequestNotificationToAdmin(
      newRequest.email,
      newRequest.title,
      newRequest.author
    );

    res.json({
      success: true,
      message: 'Solicitud registrada. El libro permanece encerrado, y serás notificado cuando esté disponible.',
      request: newRequest
    });

  } catch (error) {
    console.error('Error registrando solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la solicitud. Las sombras interfieren...'
    });
  }
});

/**
 * POST /api/requests/notify
 * Registra una suscripción para recibir avisos de novedades
 */
router.post('/notify', async (req, res) => {
  try {
    const { email, type, filters } = req.body;

    // Validaciones
    if (!email || !type) {
      return res.status(400).json({
        success: false,
        message: 'Necesito tu correo y el tipo de aviso que deseas.'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El correo proporcionado no parece válido.'
      });
    }

    // Validar tipo de notificación
    const validTypes = ['all', 'author', 'saga', 'requested'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de notificación no válido.'
      });
    }

    const result = await notifier.subscribeToNotifications(email, type, filters || {});

    res.json({
      success: result.success,
      message: result.success 
        ? 'Estaré atento… incluso desde los muros donde los libros permanecen capturados.'
        : result.message
    });

  } catch (error) {
    console.error('Error registrando notificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la suscripción.'
    });
  }
});

/**
 * GET /api/requests/pending
 * Obtiene todas las solicitudes pendientes (para admin)
 */
router.get('/pending', async (req, res) => {
  try {
    const requests = await FileHandler.readJSON(requestsPath);
    const pending = requests.filter(req => req.status === 'pending');

    res.json({
      success: true,
      count: pending.length,
      requests: pending
    });

  } catch (error) {
    console.error('Error obteniendo solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes pendientes.'
    });
  }
});

/**
 * GET /api/requests/stats
 * Obtiene estadísticas de solicitudes
 */
router.get('/stats', async (req, res) => {
  try {
    const requests = await FileHandler.readJSON(requestsPath);

    const stats = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      notified: requests.filter(r => r.status === 'notified').length,
      mostRequested: []
    };

    // Contar libros más solicitados
    const bookCounts = {};
    requests.forEach(req => {
      const key = `${req.title}|||${req.author}`;
      bookCounts[key] = (bookCounts[key] || 0) + 1;
    });

    stats.mostRequested = Object.entries(bookCounts)
      .map(([key, count]) => {
        const [title, author] = key.split('|||');
        return { title, author, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas.'
    });
  }
});

module.exports = router;
