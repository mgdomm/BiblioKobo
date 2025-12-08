#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BOOKS_FILE = path.join(__dirname, 'books.json');
const GOOGLE_BOOKS_API_KEY = 'AIzaSyA4Rm0J2mdQuCK7MChxJP-SnMrV9HVrnGo';
const DELAY_BETWEEN_CALLS = 800; // 800ms entre llamadas

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchGoogleBooksData(title, author) {
  try {
    const query = `intitle:${title} inauthor:${author}`;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1&printType=books&key=${GOOGLE_BOOKS_API_KEY}`;
    
    const response = await axios.get(url, { timeout: 5000 });
    const item = response.data?.items?.[0];
    
    if (item?.volumeInfo) {
      const vol = item.volumeInfo;
      return {
        coverUrl: vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || null,
        description: vol.description || null,
        publisher: vol.publisher || null,
        publishedDate: vol.publishedDate || null,
        pageCount: vol.pageCount || null,
        categories: vol.categories || [],
        language: vol.language || null,
        averageRating: vol.averageRating || null,
        ratingsCount: vol.ratingsCount || null,
        previewLink: vol.previewLink || null
      };
    }
  } catch (err) {
    if (err.response?.status === 429) {
      console.log(`⚠️  Rate limit - esperando 5 segundos...`);
      await sleep(5000);
      return await fetchGoogleBooksData(title, author); // Reintentar
    }
    console.error(`❌ Error: ${err.message}`);
  }
  return null;
}

async function updateAllCovers() {
  console.log('📚 Actualizando datos de libros desde Google Books...\n');
  
  const books = JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8'));
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // Solo para esta ejecución: lista de libros fallidos por título y autor
  const failedBooks = [
    { title: "Imperio de Fuego Azul", author: "Lucia Cerezo" },
    { title: "Indómita", author: "Raisa Martin Espinosa" },
    { title: "Inquebrantable", author: "Raisa Martin Espinosa" },
    { title: "Jonathan Strange y el Sr. Norrell", author: "Andrzej Sapkowski" },
    { title: "Audiolibros", author: "Desconocido" },
    { title: "pg55-images-3", author: "Desconocido" },
    { title: "Aventuras de un nino irlandes", author: "Julio Verne" },
    { title: "Imperio de Fuego Azul", author: "Lucia Cerezo" }
  ];

  // Buscar los libros en books.json que coincidan con los fallidos
  let toProcess = books.filter(book => failedBooks.some(fb => book.title === fb.title && book.author === fb.author));

  for (let i = 0; i < toProcess.length; i++) {
    const book = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${book.title} - ${book.author}`);
    const data = await fetchGoogleBooksData(book.title, book.author);
    if (data) {
      if (data.coverUrl) book.coverUrl = data.coverUrl;
      if (data.description) book.description = data.description;
      if (data.publisher) book.publisher = data.publisher;
      if (data.publishedDate) book.publishedDate = data.publishedDate;
      if (data.pageCount) book.pageCount = data.pageCount;
      if (data.categories) book.categories = data.categories;
      if (data.language) book.language = data.language;
      if (data.averageRating !== null) book.averageRating = data.averageRating;
      if (data.ratingsCount) book.ratingsCount = data.ratingsCount;
      if (data.previewLink) book.previewLink = data.previewLink;
      updated++;
      console.log(`  ✅ Datos actualizados`);
    } else {
      failed++;
      console.log(`  ❌ No encontrados`);
    }
    // Guardar progreso cada 5 libros
    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));
      console.log(`\n💾 Progreso guardado (${updated} actualizados, ${skipped} completos, ${failed} fallidos)\n`);
    }
    await sleep(DELAY_BETWEEN_CALLS);
  }

  // Guardar resultado final
  fs.writeFileSync(BOOKS_FILE, JSON.stringify(books, null, 2));

  console.log('\n✅ Proceso completado:');
  console.log(`   📖 Actualizados: ${updated}`);
  console.log(`   ✅ Ya completos: ${skipped}`);
  console.log(`   ❌ Sin datos: ${failed}`);
  console.log('   (Solo reprocesados los fallidos esta vez)');
  process.exit(0);
}

// Ejecutar
updateAllCovers().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
