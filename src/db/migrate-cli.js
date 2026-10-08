const { getDatabase, closeDatabase } = require('./index');
getDatabase();
console.log('Migraciones aplicadas correctamente.');
closeDatabase();
