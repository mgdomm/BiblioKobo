const express = require('express');
const router = express.Router();
const FileHandler = require('../utils/fileHandler');
const notifier = require('../services/notifier');
const path = require('path');

const booksPath = path.join(__dirname, '../books.json');

/**
 * POST /api/admin/add-book
 * Añade un nuevo libro y notifica a usuarios interesados
 * 
 * IMPORTANTE: En producción, proteger esta ruta con autenticación
 */
router.post('/add-book', async (req, res) => {
  try {
    const newBook = req.body;

    // Validaciones básicas
    if (!newBook.title || !newBook.author) {
      return res.status(400).json({
        success: false,
        message: 'Título y autor son obligatorios.'
      });
    }

    // Leer libros existentes
    const books = await FileHandler.readJSON(booksPath);

    // Generar ID si no existe
    if (!newBook.id) {
      newBook.id = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Añadir timestamp de creación
    newBook.createdTime = new Date().toISOString();

    // Añadir libro al JSON
    books.push(newBook);
    await FileHandler.writeJSON(booksPath, books);

    // Verificar solicitudes pendientes y notificar
    await notifier.checkPendingRequests(newBook);

    // Notificar a suscriptores
    await notifier.notifySubscribers(newBook);

    res.json({
      success: true,
      message: 'Libro capturado exitosamente. Notificaciones enviadas.',
      book: newBook
    });

  } catch (error) {
    console.error('Error añadiendo libro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al capturar el libro.'
    });
  }
});

/**
 * DELETE /api/admin/book/:id
 * Elimina un libro
 * 
 * IMPORTANTE: En producción, proteger esta ruta con autenticación
 */
router.delete('/book/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const books = await FileHandler.readJSON(booksPath);
    
    const filteredBooks = books.filter(book => book.id !== id);
    
    if (filteredBooks.length === books.length) {
      return res.status(404).json({
        success: false,
        message: 'Libro no encontrado.'
      });
    }

    await FileHandler.writeJSON(booksPath, filteredBooks);

    res.json({
      success: true,
      message: 'Libro eliminado.'
    });

  } catch (error) {
    console.error('Error eliminando libro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el libro.'
    });
  }
});

/**
 * GET /api/admin/stats
 * Obtiene estadísticas generales del sistema
 */
router.get('/stats', async (req, res) => {
  try {
    const books = await FileHandler.readJSON(booksPath);
    const requestsPath = path.join(__dirname, '../data/requests.json');
    const notificationsPath = path.join(__dirname, '../data/notifications.json');
    
    const requests = await FileHandler.readJSON(requestsPath);
    const notifications = await FileHandler.readJSON(notificationsPath);

    // Calcular estadísticas
    const stats = {
      books: {
        total: books.length,
        withSaga: books.filter(b => b.saga && b.saga.name).length,
        standalone: books.filter(b => !b.saga || !b.saga.name).length,
        categories: [...new Set(books.flatMap(b => b.categories || []))].length
      },
      requests: {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        notified: requests.filter(r => r.status === 'notified').length
      },
      notifications: {
        total: notifications.length,
        byType: {
          all: notifications.filter(n => n.type === 'all').length,
          author: notifications.filter(n => n.type === 'author').length,
          saga: notifications.filter(n => n.type === 'saga').length,
          requested: notifications.filter(n => n.type === 'requested').length
        }
      },
      mostRequestedBooks: getMostRequested(requests)
    };

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

/**
 * Función auxiliar para obtener libros más solicitados
 */
function getMostRequested(requests) {
  const bookCounts = {};
  
  requests.forEach(req => {
    const key = `${req.title}|||${req.author}`;
    if (!bookCounts[key]) {
      bookCounts[key] = {
        title: req.title,
        author: req.author,
        count: 0
      };
    }
    bookCounts[key].count++;
  });

  return Object.values(bookCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

module.exports = router;
