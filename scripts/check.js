const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const required=['server.js','src/app.js','src/db/index.js','src/routes/auth.js','src/routes/public.js','src/routes/student.js','src/routes/payments.js','src/routes/admin-core.js','src/routes/admin-cms.js','public/index.html','public/assets/js/app.js','public/assets/css/app.css'];
for(const file of required){if(!fs.existsSync(path.join(root,file))){console.error(`Falta archivo requerido: ${file}`);process.exit(1);}}
const js=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name==='node_modules')continue;const full=path.join(dir,item.name);if(item.isDirectory())walk(full);else if(/\.(?:js|cjs|mjs)$/.test(item.name))js.push(full);}}walk(root);
for(const file of js){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0){console.error(`Error de sintaxis en ${path.relative(root,file)}\n${r.stderr}`);process.exit(1);}}
console.log(`OK: ${required.length} archivos estructurales y ${js.length} archivos JavaScript validados.`);
