const fs = require('fs');
const https = require('https');

const file = fs.createWriteStream('public/icon.ico');
https.get('https://raw.githubusercontent.com/electron/electron/main/shell/browser/resources/win/electron.ico', response => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('✅ Icône téléchargée !');
  });
}).on('error', () => {
  console.log('❌ Pas de connexion, création manuelle nécessaire');
});