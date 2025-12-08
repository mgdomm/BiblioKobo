const fs = require('fs');
const books = JSON.parse(fs.readFileSync('books.json', 'utf8'));

const noCover = books.filter(b => !b.coverUrl);

console.log('\n📚 Libros sin portada de Google Books: ' + noCover.length + '\n');
console.log('═'.repeat(80));

noCover.forEach((b, i) => {
  console.log('\n' + (i+1) + '. ' + b.title);
  console.log('   Autor: ' + b.author);
  if (b.saga?.name) {
    console.log('   Saga: ' + b.saga.name + (b.saga.number ? ' #' + b.saga.number : ''));
  }
  console.log('   ID: ' + b.id);
});

console.log('\n' + '═'.repeat(80) + '\n');
