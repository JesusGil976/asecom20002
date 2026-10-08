const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config');

const signatures = {
  jpeg(buffer) { return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; },
  png(buffer) { return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])); },
  webp(buffer) { return buffer.length >= 12 && buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP'; },
  pdf(buffer) { return buffer.length >= 5 && buffer.toString('ascii',0,5) === '%PDF-'; }
};

function detectFile(buffer) {
  if (signatures.jpeg(buffer)) return { ext: '.jpg', mime: 'image/jpeg', kind: 'image' };
  if (signatures.png(buffer)) return { ext: '.png', mime: 'image/png', kind: 'image' };
  if (signatures.webp(buffer)) return { ext: '.webp', mime: 'image/webp', kind: 'image' };
  if (signatures.pdf(buffer)) return { ext: '.pdf', mime: 'application/pdf', kind: 'pdf' };
  return null;
}

function validateBuffer(file, { allow = ['image'], maxBytes = config.maxImageBytes } = {}) {
  if (!file?.buffer?.length) throw Object.assign(new Error('Archivo vacío o ausente.'), { status: 400 });
  if (file.buffer.length > maxBytes) throw Object.assign(new Error('El archivo supera el tamaño permitido.'), { status: 413 });
  const detected = detectFile(file.buffer);
  if (!detected || !allow.includes(detected.kind)) throw Object.assign(new Error('Tipo de archivo no permitido.'), { status: 400 });
  const declared=String(file.mimetype||'').toLowerCase();
  if(declared && declared!=='application/octet-stream' && declared!==detected.mime)throw Object.assign(new Error('El tipo declarado no coincide con el archivo.'),{status:400});
  const bytes=file.buffer;let width=0,height=0;
  if(detected.mime==='image/png'){
    if(bytes.length<45 || bytes.toString('ascii',12,16)!=='IHDR' || !bytes.subarray(-8,-4).equals(Buffer.from('IEND')))throw Object.assign(new Error('Imagen PNG incompleta.'),{status:400});
    width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);
  }else if(detected.mime==='image/jpeg'){
    if(bytes.length<12 || bytes.lastIndexOf(Buffer.from([0xff,0xd9]))<0)throw Object.assign(new Error('Imagen JPEG incompleta.'),{status:400});
    let i=2;while(i+8<bytes.length){if(bytes[i]!==0xff){i++;continue;}const marker=bytes[i+1];if(marker===0xda)break;if(marker===0xd8||marker===0xd9){i+=2;continue;}const length=bytes.readUInt16BE(i+2);if(length<2)break;if([0xc0,0xc1,0xc2].includes(marker)){height=bytes.readUInt16BE(i+5);width=bytes.readUInt16BE(i+7);break;}i+=2+length;}
    if(!width||!height)throw Object.assign(new Error('Imagen JPEG inválida.'),{status:400});
  }else if(detected.mime==='image/webp'){
    if(bytes.length<30 || bytes.readUInt32LE(4)+8!==bytes.length)throw Object.assign(new Error('Imagen WebP incompleta.'),{status:400});
    const kind=bytes.toString('ascii',12,16);
    if(kind==='VP8X'){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1;}
    else if(kind==='VP8L'){const bits=bytes.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
    else if(kind==='VP8 '){width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;}
    if(!width||!height)throw Object.assign(new Error('Imagen WebP inválida.'),{status:400});
  }else if(detected.kind==='pdf' && !bytes.subarray(-2048).includes(Buffer.from('%%EOF')))throw Object.assign(new Error('PDF incompleto.'),{status:400});
  if(detected.kind==='image' && (!width||!height||width*height>40000000||width>16000||height>16000))throw Object.assign(new Error('La imagen supera las dimensiones permitidas (40 megapíxeles).'),{status:400});
  return detected;
}

function writeFile(file, directory, options = {}) {
  const detected = validateBuffer(file, options);
  fs.mkdirSync(directory, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${detected.ext}`;
  const storagePath = path.join(directory, storedName);
  fs.writeFileSync(storagePath, file.buffer, { flag: 'wx', mode: 0o600 });
  return { storedName, storagePath, mimeType: detected.mime, sizeBytes: file.buffer.length, kind: detected.kind };
}

function safePublicUpload(file) {
  const saved = writeFile(file, config.publicUploadDir, { allow: ['image'], maxBytes: config.maxImageBytes });
  return { ...saved, publicUrl: `/uploads/${saved.storedName}` };
}

function safePrivateUpload(file, { allow = ['image','pdf'], maxBytes = config.maxReceiptBytes } = {}) {
  return writeFile(file, config.privateUploadDir, { allow, maxBytes });
}

module.exports = { detectFile, validateBuffer, safePublicUpload, safePrivateUpload, writeFile };
