const { google } = require('googleapis');
const fs = require('fs');

async function cleanDrive() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'service-account.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  
  const drive = google.drive({ version: 'v3', auth });
  const folderId = '1-4G6gGNtt6KVS90AbWbtH3JlpetHrPEi';
  
  // Obtener todos los archivos del Drive
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    pageSize: 1000
  });
  
  // Obtener IDs del JSON
  const books = JSON.parse(fs.readFileSync('books.json', 'utf8'));
  const bookIds = new Set(books.map(b => b.id));
  
  // Encontrar archivos que no están en el JSON
  const allFiles = res.data.files || [];
  const filesToDelete = allFiles.filter(f => !bookIds.has(f.id));
  
  console.log(`📊 Total archivos en Drive: ${allFiles.length}`);
  console.log(`📊 Total libros en JSON: ${books.length}`);
  console.log(`📋 Archivos en Drive NO en JSON: ${filesToDelete.length}\n`);
  
  if (filesToDelete.length === 0) {
    console.log('✅ Todos los archivos del Drive están en el JSON');
    return;
  }
  
  filesToDelete.forEach(f => console.log(`  - ${f.name} (ID: ${f.id})`));
  
  console.log(`\n🗑️  Eliminando ${filesToDelete.length} archivos...\n`);
  
  for (const file of filesToDelete) {
    try {
      await drive.files.delete({ fileId: file.id });
      console.log(`  ✅ Eliminado: ${file.name}`);
    } catch (err) {
      console.log(`  ❌ Error al eliminar ${file.name}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Limpieza completada`);
}

cleanDrive().catch(console.error);
