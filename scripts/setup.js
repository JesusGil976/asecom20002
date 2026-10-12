const fs=require('fs'),crypto=require('crypto'),path=require('path');
const target=path.join(__dirname,'..','.env');if(fs.existsSync(target)){console.error('.env ya existe. No se modificó.');process.exitCode=1;}else{
 const source=fs.readFileSync(path.join(__dirname,'..','.env.example'),'utf8');const password=crypto.randomBytes(18).toString('base64url');
 const content=source.replace('SESSION_SECRET=dev-only-change-me','SESSION_SECRET='+crypto.randomBytes(48).toString('hex')).replace('ADMIN_PASSWORD=CambiaEstaClave123!','ADMIN_PASSWORD='+password);
 fs.writeFileSync(target,content,{flag:'wx',mode:0o600});console.log('Configuración creada en .env. Consulta ADMIN_EMAIL y ADMIN_PASSWORD allí para el primer acceso. Configura PUBLIC_URL y SMTP antes de producción.');
}
