const fs=require('fs');
const checks=[
  ['package.json', /"version"\s*:\s*"5\.3\.0"/],
  ['src/app.js', /version:\s*require\(["']\.\.\/package\.json["']\)\.version/],
  ['src/app.js', /createCertificateLayoutService/],
  ['src/app.js', /certificateLayout/],
  ['src/routes/admin-core.js', /router\.get\(\s*["']\/certificates\/layout["']/],
  ['src/routes/admin-core.js', /router\.put\(\s*["']\/certificates\/layout["']/],
  ['src/services/certificate-layout.js', /createCertificateLayoutService/],
  ['public/assets/js/admin.js', /\/api\/admin\/certificates\/layout/],
];
let ok=true;
for(const [file,re] of checks){
  try{
    const text=fs.readFileSync(file,'utf8');
    const pass=re.test(text);
    console.log(`${pass?'OK':'FAIL'} ${file} ${re}`);
    if(!pass)ok=false;
  }catch(e){console.log(`FAIL ${file} missing`);ok=false;}
}
if(!ok){process.exitCode=1;console.error('\nLa verificación de compatibilidad falló.');}
else console.log('\nAcademiaVE v5.3.0 conserva las rutas del editor de certificados.');
