const express = require('express');
const router = express.Router();
const FileHandler = require('../utils/fileHandler');
const notifier = require('../services/notifier');
const ollamaService = require('../services/ollamaService');
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
 * POST /api/books/recommend
 * Recomendaciones personalizadas con IA basadas en preferencias
 */
router.post('/recommend', async (req, res) => {
  try {
    const { type, preferences } = req.body;
    
    if (!type || !preferences) {
      return res.status(400).json({
        success: false,
        message: 'Necesito saber qué tipo de libro buscas y tus preferencias.'
      });
    }

    const books = await FileHandler.readJSON(booksPath);
    
    // Función para buscar libros relacionados con una preferencia
    const booksMatchingPreference = (allBooks, pref) => {
      const prefLower = pref.toLowerCase();
      
      return allBooks.filter(book => {
        // Buscar en múltiples campos
        const title = (book.title || '').toLowerCase();
        const author = (book.author || '').toLowerCase();
        const description = (book.description || '').toLowerCase();
        const categories = (book.categories || []).map(c => c.toLowerCase()).join(' ');
        
        // Combinar todos los textos para buscar
        const fullText = `${title} ${author} ${description} ${categories}`;
        
        // Búsqueda flexible: buscar variaciones de la preferencia
        const searchTerms = [
          prefLower,
          prefLower.replace('dragones', 'dragon'),
          prefLower.replace('dragón', 'dragon'),
          prefLower.replace('dragones', 'wyrm'),
          prefLower.replace('misterio', 'secreto'),
          prefLower.replace('misterios', 'secretos'),
          prefLower.replace('fantasía oscura', 'oscur'),
        ].filter(Boolean);
        
        // Si alguno de los términos de búsqueda está en el texto, es un match
        return searchTerms.some(term => fullText.includes(term));
      });
    };
    
    // Filtrar libros según tipo
    let filtered = books;
    if (type === 'saga') {
      filtered = filtered.filter(book => book.saga && book.saga.name);
    } else if (type === 'standalone') {
      filtered = filtered.filter(book => !book.saga || !book.saga.name);
    }

    // IMPORTANTE: Filtrar por preferencia/tema
    const preferenceMatches = booksMatchingPreference(filtered, preferences);
    
    // Si hay coincidencias por tema, usar esas. Si no, usar todos los filtrados
    const booksToRecommend = preferenceMatches.length > 0 ? preferenceMatches : filtered;

    if (booksToRecommend.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: `No hay libros con "${preferences}" en el catálogo capturado... aún.`,
        books: []
      });
    }

    // Seleccionar 3 libros aleatorios de los que coinciden
    const selectedBooks = [];
    const shuffled = booksToRecommend.sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(3, shuffled.length); i++) {
      selectedBooks.push(shuffled[i]);
    }

    // Generar recomendación introductoria sin repetir la preferencia
    let recommendation = 'He encontrado estas 3 joyas literarias que coinciden perfectamente con tus gustos:';

    // Función para generar razones inteligentes basadas en el tema
    const generateSmartReason = (book, preferences, index) => {
      const prefLower = preferences.toLowerCase();
      
      // Templates específicos por tema
      let reasonTemplates = [];
      
      // Detectar tema y usar templates apropiados
      if (prefLower.includes('dragón') || prefLower.includes('dragon')) {
        reasonTemplates = [
          `Un mundo épico donde los dragones no son solo criaturas, sino fuerzas determinantes que moldean el destino.`,
          `La presencia de dragones es magistral: poderosos, misteriosos y centrales a la trama que te cautivará.`,
          `Una saga donde las bestias aladas juegan un papel fundamental en los giros más emocionantes.`,
          `Los dragones aquí son protagonistas silenciosos de la historia, llenos de secretos y poder.`,
          `Una construcción de mundo donde los dragones representan el verdadero conflicto y la transformación.`,
          `Te sumergirás en un universo donde la dinámica con los dragones define cada decisión crucial.`,
          `Las descripciones de dragones son tan vívidas y aterradoras que cobran vida en tu imaginación.`,
          `Un épico que entrelaza la magia de los dragones con política y venganza de manera perfecta.`,
        ];
      } else if (prefLower.includes('magia') || prefLower.includes('mágico')) {
        reasonTemplates = [
          `Un sistema de magia complejo y cautivador que te atrapará desde la primera página.`,
          `La magia aquí no es un simple accesorio: es el alma de todo lo que sucede en la historia.`,
          `Un libro donde los secretos mágicos se revelan gradualmente, creando tensión y asombro constante.`,
          `La construcción de este mundo mágico es tan detallada que sentirás que perteneces a él.`,
          `Una saga donde cada hechizo, cada ritual, cada artefacto tiene peso y consecuencias reales.`,
          `Te fascinará cómo la magia entrelaza con el destino de los personajes de manera inevitable.`,
          `El sistema mágico es tan original que redefinirá tus expectativas del género.`,
          `Una historia donde dominar la magia es sinónimo de poder, peligro y transformación absoluta.`,
        ];
      } else if (prefLower.includes('romance') || prefLower.includes('romántico')) {
        reasonTemplates = [
          `Te enamorarás de la profundidad del romance mientras navegas los conflictos que caracterizan este épico.`,
          `Una historia de amor que crece y se fortalece a través de adversidades imposibles.`,
          `El romance aquí no es un subplot: es el corazón emocional que late en cada capítulo.`,
          `Combina pasión y complicidad de manera tan natural que querrás que nunca termine.`,
          `Una relación que evolucionará, se probará y te hará creer en el poder transformador del amor.`,
          `El viaje romántico es tan épico como las batallas que rodean a los protagonistas.`,
          `Prepárate para un romance que te golpeará emocionalmente en los momentos menos esperados.`,
          `Una historia donde dos personas se encuentran en el caos y crean algo verdaderamente hermoso.`,
        ];
      } else if (prefLower.includes('fantasía oscura') || prefLower.includes('oscuro') || prefLower.includes('oscura')) {
        reasonTemplates = [
          `Un mundo donde la oscuridad es tangible y los personajes deben navegar la moralidad gris.`,
          `La atmósfera es tan sombría y envolvente que te sentirás sumergido en la penumbra.`,
          `Una historia que no teme explorar los aspectos más oscuros del poder y la ambición humana.`,
          `El tone es sombrío pero hipnotizante: cada giro te mantiene en la oscuridad, esperando la luz.`,
          `Una saga donde el mal no es simplemente vencido, sino explorado en toda su complejidad.`,
          `Te cautivará la forma en que la oscuridad es tratada no como enemiga, sino como realidad.`,
          `Un viaje por los aspectos más peligrosos de un mundo donde la luz es raramente bienvenida.`,
          `La construcción de este universo oscuro es tan detallada que sentirás cada sombra.`,
        ];
      } else if (prefLower.includes('misterio') || prefLower.includes('suspense')) {
        reasonTemplates = [
          `Un misterio tan bien construido que querrás devorar las páginas para descubrir la verdad.`,
          `Cada capítulo abre nuevas preguntas mientras resuelve otras, manteniéndote completamente atrapado.`,
          `La tensión es constante: nunca sabes quién traicionará, qué se revelará a continuación.`,
          `Un secreto de fondo que permea toda la trama y te hará reconsiderar todo lo que leíste.`,
          `La búsqueda de la verdad es tan emocionante como los descubrimientos mismos.`,
          `Una saga donde los misterios se entrelazan de manera que todo tiene significado.`,
          `Prepárate para giros inesperados que desmantelarán todo lo que creías saber.`,
          `El suspense es relentless: cada revelación te acerca al verdadero secreto que guarda la historia.`,
        ];
      } else if (prefLower.includes('guerra') || prefLower.includes('batalla') || prefLower.includes('conflicto')) {
        reasonTemplates = [
          `Un épico de guerra donde los conflictos militares moldean destinos y cambian imperios.`,
          `Las batallas aquí son descritas con crudeza y estrategia, poniendo a prueba a los guerreros.`,
          `Una saga donde la guerra no es solo telón de fondo, sino el corazón palpitante de la trama.`,
          `Conflictos épicos que enfrentan alianzas imposibles y decisiones que cambian el curso de la historia.`,
          `Una construcción de mundo donde la guerra define culturas, lealtades y el futuro de naciones.`,
          `Te sumergirás en campos de batalla llenos de honor, traición y sacrificio irreversible.`,
          `Las estrategias militares son tan complejas y emocionantes como las motivaciones de los combatientes.`,
          `Un relato épico donde el costo humano de la guerra es tan importante como la victoria misma.`,
        ];
      } else {
        // Template genérico si no coincide con categorías específicas
        reasonTemplates = [
          `Una novela cautivadora que te atrapará completamente desde el comienzo.`,
          `Un épico bien construido con personajes complejos y una trama imposible de soltar.`,
          `Una saga que combina elementos fascinantes de manera perfecta para ti.`,
          `Una historia que te hará perder la noción del tiempo mientras lees.`,
          `Un libro que captura la esencia de lo que buscas de manera magistral.`,
          `Una obra que te llevará a lugares emocionales inesperados.`,
          `Un viaje narrativo que será difícil de olvidar después de terminarlo.`,
          `Una saga donde cada página te acerca más a un final emocionante.`,
        ];
      }

      // Seleccionar una razón única según el índice
      return reasonTemplates[index % reasonTemplates.length];
    };

    // Generar razones personalizadas para CADA libro
    const booksWithReasons = [];
    for (let i = 0; i < selectedBooks.length; i++) {
      const book = selectedBooks[i];
      let reason = '';

      // Primero intentar con Ollama (con mejor prompt)
      try {
        const aiPrompt = `Como crítico literario, escribe 1-2 oraciones por qué "${book.title}" de ${book.author} sería perfecto para alguien que adora "${preferences}". Sé muy específico sobre elementos del libro que conecten con "${preferences}". NO repitas la palabra "${preferences}".`;
        
        reason = await ollamaService.generate(aiPrompt);
        reason = reason.trim();
        
        // Si la respuesta es muy corta, vacía o repite mucho la preferencia, usar fallback
        if (!reason || reason.length < 25 || reason.toLowerCase().split(preferences.toLowerCase()).length > 2) {
          throw new Error('Respuesta inválida o insuficiente');
        }
      } catch (error) {
        console.warn(`Usando razón generada para ${book.title}:`, error.message);
        // Usar razones inteligentes y específicas basadas en el tema
        reason = generateSmartReason(book, preferences, i);
      }

      booksWithReasons.push({
        ...book,
        reason: reason
      });
    }

    res.json({
      success: true,
      found: true,
      recommendation: recommendation,
      books: booksWithReasons
    });

  } catch (error) {
    console.error('Error en recomendación personalizada:', error);
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

    // Filtrar libros similares (evitar duplicados)
    let recommendations = books.filter(book => {
      // Excluir los libros favoritos (comparar por ID)
      if (favoriteBooks.some(fav => fav.id && book.id && fav.id === book.id)) {
        return false;
      }
      
      // Excluir también por título (para evitar duplicados con diferentes autores)
      if (favoriteBooks.some(fav => fav.title && book.title && 
          fav.title.toLowerCase() === book.title.toLowerCase())) {
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
      if (favoriteAuthors.has(book.author?.toLowerCase())) {
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
    // Evitar duplicados por título
    const seenTitles = new Set();
    recommendations = recommendations
      .filter(book => {
        const titleLower = (book.title || '').toLowerCase();
        if (seenTitles.has(titleLower)) {
          return false;
        }
        seenTitles.add(titleLower);
        return true;
      })
      .sort(() => Math.random() - 0.5)
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
