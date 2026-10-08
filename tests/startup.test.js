const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{spawn,spawnSync}=require('child_process');
test('server.js arranca instalación limpia, responde health y cierra limpiamente',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'academiave-start-'));const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'development',PORT:'0',DATA_DIR:tmp,PUBLIC_UPLOAD_DIR:path.join(tmp,'public'),DB_FILE:path.join(tmp,'academy.sqlite'),SESSION_SECRET:'startup-test-secret-abcdefghijklmnopqrstuvwxyz',ADMIN_EMAIL:'admin@startup.local',ADMIN_PASSWORD:'StartupPassword2026!',LOG_LEVEL:'error'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
 try{
  const port=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(new Error('Startup timed out: '+stderr)),10000);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Unexpected startup exit '+code+': '+stderr));});child.stdout.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const record=JSON.parse(line);if(record.event==='server_started'){clearTimeout(timer);resolve(record.port);}}catch{}}});});
  const response=await fetch(`http://127.0.0.1:${port}/api/health`);assert.equal(response.status,200);assert.equal((await response.json()).version,'5.3.0');assert.ok(fs.existsSync(path.join(tmp,'academy.sqlite')));
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');assert.equal(await exited,0,stderr);
 }finally{if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(tmp,{recursive:true,force:true});}
});
test('producción rechaza secretos predeterminados antes de abrir el servidor',()=>{
 const result=spawnSync(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',SESSION_SECRET:'dev-only-change-me'},encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/SESSION_SECRET/);
});
