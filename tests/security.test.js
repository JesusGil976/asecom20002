const test=require('node:test');
const assert=require('node:assert/strict');
const {safeHttpUrl,safeGoogleMapsEmbed,slugify,normalizeEmail}=require('../src/utils/text');
const {detectFile}=require('../src/services/files');

test('rechaza protocolos peligrosos',()=>{
  assert.equal(safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpUrl('data:text/html,boom'), '');
  assert.match(safeHttpUrl('https://example.com/a'), /^https:\/\/example\.com/);
});

test('Google Maps solo acepta hosts permitidos',()=>{
  assert.match(safeGoogleMapsEmbed('https://www.google.com/maps/embed?pb=test'), /^https:\/\/www\.google\.com/);
  assert.equal(safeGoogleMapsEmbed('https://evil.example/maps/embed?pb=test'), '');
  assert.match(safeGoogleMapsEmbed('<iframe src="https://www.google.com/maps/embed?pb=abc"></iframe>'), /^https:\/\/www\.google\.com/);
});

test('normaliza entradas básicas',()=>{
  assert.equal(normalizeEmail('  USER@Example.COM '),'user@example.com');
  assert.equal(slugify('Curso de IA: Básico'),'curso-de-ia-basico');
});

test('detecta archivos por firma y no por extensión',()=>{
  assert.equal(detectFile(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]))?.mime,'image/png');
  assert.equal(detectFile(Buffer.from('%PDF-1.7\n'))?.mime,'application/pdf');
  assert.equal(detectFile(Buffer.from('not-an-image')),null);
});
