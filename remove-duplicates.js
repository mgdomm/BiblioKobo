const fs = require('fs');
const path = require('path');

const BOOKS_FILE = path.join(__dirname, 'books.json');

// Leer books.json
let books = JSON.parse(fs.readFileSync(BOOKS_FILE, 'utf8'));

console.log(`📚 Total de libros antes: ${books.length}`);

// Función para crear clave única basada en título, autor y saga
function getBookKey(book) {
  const title = (book.title || '').toLowerCase().trim();
  const author = (book.author || '').toLowerCase().trim();
  const sagaName = (book.saga?.name || '').toLowerCase().trim();
  const sagaNumber = book.saga?.number || 0;
  
  return `${title}|${author}|${sagaName}|${sagaNumber}`;
}

// Función para contar cuántos campos tienen datos
function countFilledFields(book) {
  let count = 0;
  if (book.coverUrl) count++;
  if (book.description) count++;
  if (book.publisher) count++;
  if (book.publishedDate) count++;
  if (book.pageCount) count++;
  if (book.categories && book.categories.length > 0) count++;
  if (book.language) count++;
  if (book.previewLink) count++;
  return count;
}

// Agrupar libros por clave única
const bookGroups = new Map();

books.forEach(book => {
  const key = getBookKey(book);
  if (!bookGroups.has(key)) {
    bookGroups.set(key, []);
  }
  bookGroups.get(key).push(book);
});

// Encontrar duplicados y quedarse con el mejor
const uniqueBooks = [];
let duplicatesRemoved = 0;

bookGroups.forEach((group, key) => {
  if (group.length === 1) {
    // No hay duplicados
    uniqueBooks.push(group[0]);
  } else {
    // Hay duplicados, quedarse con el que tenga más datos
    console.log(`\n🔍 Duplicado encontrado: ${group[0].title} - ${group[0].author}`);
    console.log(`   Número de copias: ${group.length}`);
    
    group.forEach((book, idx) => {
      const fields = countFilledFields(book);
      console.log(`   ${idx + 1}. ID: ${book.id}, Campos completados: ${fields}`);
    });
    
    // Ordenar por cantidad de campos completados (descendente)
    group.sort((a, b) => countFilledFields(b) - countFilledFields(a));
    
    // Quedarse con el primero (el más completo)
    const bestBook = group[0];
    console.log(`   ✅ Manteniendo: ID ${bestBook.id} (más completo)`);
    
    uniqueBooks.push(bestBook);
    duplicatesRemoved += (group.length - 1);
  }
});

console.log(`\n📊 Resumen:`);
console.log(`   Libros antes: ${books.length}`);
console.log(`   Libros después: ${uniqueBooks.length}`);
console.log(`   Duplicados eliminados: ${duplicatesRemoved}`);

// Guardar el resultado
fs.writeFileSync(BOOKS_FILE, JSON.stringify(uniqueBooks, null, 2));
console.log(`\n✅ Archivo actualizado: ${BOOKS_FILE}`);
