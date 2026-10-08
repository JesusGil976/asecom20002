const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/assets/js/app.js'),'utf8');
const views=fs.readFileSync(path.join(root,'public/assets/js/views.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/assets/css/app.css'),'utf8').replace(/\s*([{}:;,()>/])\s*/g,'$1').replace(/;}/g,'}');

test('header móvil agrupa CTA principal y menú en el extremo derecho',()=>{
  assert.match(app,/class=\\?"mobile-header-actions\\?"/);
  assert.match(app,/class=\\?"btn mobile-header-cta\\?"/);
  assert.match(app,/mobile-header-actions[\s\S]*mobilePrimaryAction[\s\S]*id=\\?"menu-btn\\?"/);
  assert.match(css,/\.mobile-header-actions\{display:none;align-items:center;gap:8px;margin-left:auto/);
  assert.match(css,/@media\(max-width:640px\)[\s\S]*\.brand>span:last-child\{display:none\}/);
});

test('aula ofrece navegación anterior y siguiente y barra móvil accesible',()=>{
  assert.match(views,/id="previous-lesson"/);
  assert.match(views,/id="next-lesson"/);
  assert.match(views,/Siguiente clase/);
  assert.match(views,/aria-label="Navegación entre clases"/);
  assert.match(css,/\.classroom-pagination\{position:sticky;z-index:20;bottom:0/);
});

test('QA responsive cubre teléfono pequeño, teléfono estándar, tablet y evita overflow global',()=>{
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.match(css,/@media\(max-width:820px\)/);
  assert.match(css,/@media\(max-width:1024px\)/);
  assert.match(css,/body\{overflow-x:clip\}/);
  assert.match(css,/\.admin-sidebar nav\{display:flex;gap:6px;overflow-x:auto/);
});

test('editor de certificados permite posicionar campos sobre frente y reverso',()=>{
  const admin=fs.readFileSync(path.join(root,'public/assets/js/admin.js'),'utf8');
  assert.match(admin,/Editor de posiciones/);
  assert.match(admin,/data-cert-side=\\?"front\\?"/);
  assert.match(admin,/data-cert-side=\\?"back\\?"/);
  assert.match(admin,/certificate-field-x/);
  assert.match(admin,/certificate-field-y/);
  assert.match(admin,/certificate-pdf-preview/);
  assert.match(css,/\.certificate-stage\{position:relative;width:100%;aspect-ratio:841\.89\/595\.28/);
  assert.match(css,/\.certificate-preview-field\{position:absolute/);
});
