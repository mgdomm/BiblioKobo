const express = require('express');
const router = express.Router();
const FileHandler = require('../utils/fileHandler');
const notifier = require('../services/notifier');
const path = require('path');

const booksPath = path.join(__dirname, '../books.json');

/**
 * GET /api/books/search
 * Busca libros por título, autor o saga
 */
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Proporciona algo que buscar entre los muros...' 
      });
    }

    const books = await FileHandler.readJSON(booksPath);
    const searchTerm = query.toLowerCase().trim();

    const results = books.filter(book => {
      const titleMatch = book.title && book.title.toLowerCase().includes(searchTerm);
      const authorMatch = book.author && book.author.toLowerCase().includes(searchTerm);
      const sagaMatch = book.saga && book.saga.name && book.saga.name.toLowerCase().includes(searchTerm);
      
      return titleMatch || authorMatch || sagaMatch;
    });

    if (results.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: 'No está disponible… aún.',
        books: []
      });
    }

    res.json({
      success: true,
      found: true,
      message: `He encontrado ${results.length} libro${results.length > 1 ? 's' : ''} capturado${results.length > 1 ? 's' : ''}:`,
      books: results.slice(0, 10) // Limitar a 10 resultados
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Algo se mueve en las sombras... error al buscar.' 
    });
  }
});

/**
 * GET /api/books/recommend
 * Recomienda libros según categoría y tipo
 */
router.get('/recommend', async (req, res) => {
  try {
    const { category, type } = req.query;
    const books = await FileHandler.readJSON(booksPath);

    let filtered = books;

    // Filtrar por categoría si se proporciona
    if (category && category !== 'all') {
      filtered = filtered.filter(book => 
        book.categories && 
        book.categories.some(cat => cat.toLowerCase().includes(category.toLowerCase()))
      );
    }

    // Filtrar por tipo (saga o autoconclusivo)
    if (type === 'saga') {
      filtered = filtered.filter(book => book.saga && book.saga.name);
    } else if (type === 'standalone') {
      filtered = filtered.filter(book => !book.saga || !book.saga.name);
    }

    if (filtered.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: 'No hay libros capturados con esas características... por ahora.',
        book: null
      });
    }

    // Seleccionar un libro aleatorio
    const randomBook = filtered[Math.floor(Math.random() * filtered.length)];

    res.json({
      success: true,
      found: true,
      message: 'Este libro permanece capturado, pero podría ser tu próxima lectura:',
      book: randomBook
    });

  } catch (error) {
    console.error('Error en recomendación:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Las sombras interfieren... error al recomendar.' 
    });
  }
});

/**
 * POST /api/books/test
 * Test lector basado en 3 libros favoritos
 */
router.post('/test', async (req, res) => {
  try {
    const { favoriteBooks } = req.body;

    if (!favoriteBooks || favoriteBooks.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Necesito exactamente 3 libros para analizar tus preferencias.'
      });
    }

    const books = await FileHandler.readJSON(booksPath);
    
    // Extraer categorías y autores de los favoritos
    const favoriteCategories = new Set();
    const favoriteAuthors = new Set();
    const isSagaLover = favoriteBooks.some(book => book.saga);

    favoriteBooks.forEach(book => {
      if (book.categories) {
        book.categories.forEach(cat => favoriteCategories.add(cat.toLowerCase()));
      }
      if (book.author) {
        favoriteAuthors.add(book.author.toLowerCase());
      }
    });

    // Filtrar libros similares
    let recommendations = books.filter(book => {
      // Excluir los libros favoritos
      if (favoriteBooks.some(fav => fav.id === book.id)) {
        return false;
      }

      let score = 0;

      // Puntuación por categorías coincidentes
      if (book.categories) {
        book.categories.forEach(cat => {
          if (favoriteCategories.has(cat.toLowerCase())) {
            score += 2;
          }
        });
      }

      // Puntuación por autor coincidente
      if (favoriteAuthors.has(book.author.toLowerCase())) {
        score += 3;
      }

      // Puntuación por preferencia de saga
      if (isSagaLover && book.saga) {
        score += 1;
      } else if (!isSagaLover && !book.saga) {
        score += 1;
      }

      return score > 0;
    });

    // Ordenar por puntuación implícita y tomar los 3 mejores
    recommendations = recommendations
      .sort(() => Math.random() - 0.5) // Añadir algo de aleatoriedad
      .slice(0, 3);

    if (recommendations.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: 'Tus gustos son... peculiares. No encuentro coincidencias entre los libros capturados.',
        recommendations: []
      });
    }

    res.json({
      success: true,
      found: true,
      message: 'Interesante elección. Estos libros, aún retenidos en Azkaban Reads, podrían interesarte:',
      recommendations
    });

  } catch (error) {
    console.error('Error en test lector:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Algo perturbó el análisis... inténtalo de nuevo.' 
    });
  }
});

/**
 * GET /api/books/similar/:bookId
 * Encuentra libros similares a uno específico
 */
router.get('/similar/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const books = await FileHandler.readJSON(booksPath);

    const book = books.find(b => b.id === bookId);
    
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Ese libro se ha desvanecido en las sombras...'
      });
    }

    // Buscar libros similares
    const similar = books.filter(b => {
      if (b.id === bookId) return false;

      // Mismo autor
      if (b.author === book.author) return true;

      // Misma saga
      if (book.saga && b.saga && book.saga.name === b.saga.name) return true;

      // Categorías coincidentes
      if (book.categories && b.categories) {
        const hasCommonCategory = book.categories.some(cat => 
          b.categories.includes(cat)
        );
        if (hasCommonCategory) return true;
      }

      return false;
    }).slice(0, 5);

    res.json({
      success: true,
      found: similar.length > 0,
      message: similar.length > 0 
        ? 'Otros libros capturados que podrían interesarte:' 
        : 'No hay otros libros similares... por ahora.',
      books: similar
    });

  } catch (error) {
    console.error('Error buscando similares:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en la búsqueda de similares.' 
    });
  }
});

/**
 * GET /api/books/categories
 * Obtiene todas las categorías disponibles
 */
router.get('/categories', async (req, res) => {
  try {
    const books = await FileHandler.readJSON(booksPath);
    const categories = new Set();

    books.forEach(book => {
      if (book.categories) {
        book.categories.forEach(cat => categories.add(cat));
      }
    });

    res.json({
      success: true,
      categories: Array.from(categories).sort()
    });

  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener categorías.' 
    });
  }
});

module.exports = router;
