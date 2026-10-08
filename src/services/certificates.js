const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const { config } = require('../config');
const { cleanText, safeHttpUrl } = require('../utils/text');

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return rgb(15 / 255, 23 / 255, 42 / 255);
  return rgb(
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function localTemplatePath(url) {
  const value = cleanText(url, 2000);
  if (!value.startsWith('/uploads/certificates/')) return null;
  const filename = path.basename(value);
  const resolved = path.resolve(config.certificateTemplateDir, filename);
  const root = path.resolve(config.certificateTemplateDir) + path.sep;
  return resolved.startsWith(root) ? resolved : null;
}

async function loadTemplate(url) {
  const local = localTemplatePath(url);
  if (local) {
    if (!fs.existsSync(local)) throw Object.assign(new Error('La plantilla no está disponible. Sube nuevamente la imagen.'), {status:422});
    const bytes=fs.readFileSync(local);require('./files').validateBuffer({buffer:bytes},{allow:['image'],maxBytes:12*1024*1024});return bytes;
  }
  const bytes=await require('./remote-template').loadRemoteTemplate(url);require('./files').validateBuffer({buffer:bytes},{allow:['image'],maxBytes:12*1024*1024});return bytes;
}

async function embedTemplate(pdf, page, bytes) {
  if (!bytes) return false;
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const image = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  // Contain: mantiene proporción e imagen completa; coordenadas relativas a la página A4.
  const scale = Math.min(page.getWidth() / image.width, page.getHeight() / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height });
  return true;
}

function fontForStyle(fonts, style) {
  if (style === 'bold') return fonts.bold;
  if (style === 'italic') return fonts.italic;
  if (style === 'boldItalic') return fonts.boldItalic;
  return fonts.regular;
}

function boxFromPercent(page, field) {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const x = pageWidth * (Number(field.x) / 100);
  const width = pageWidth * (Number(field.width) / 100);
  const height = pageHeight * (Number(field.height) / 100);
  const top = pageHeight - pageHeight * (Number(field.y) / 100);
  const y = top - height;
  return { x, y, width, height, top };
}

function wrapText(font, text, size, maxWidth) {
  const lines=[];
  for(const paragraph of String(text||'').split(/\n/)) {
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next=line?`${line} ${word}`:word;
      if(font.widthOfTextAtSize(next,size)<=maxWidth){line=next;continue;}
      if(line){lines.push(line);line='';}
      // Break unusually long words and codes instead of painting beyond the field.
      for(const char of word){if(line && font.widthOfTextAtSize(line+char,size)>maxWidth){lines.push(line);line='';}line+=char;}
    }
    lines.push(line);
  }
  return lines;
}
function fittedLines(font, text, preferredSize, box, { minSize = 7, maxLines = Infinity } = {}) {
  const start=Math.max(minSize,Number(preferredSize)||12);
  const minimum=wrapText(font,text,minSize,box.width);
  if(minimum.length>maxLines||minimum.length*minSize*1.22>box.height)throw Object.assign(new Error('El texto no cabe en el campo del certificado. Amplía su ancho/alto o ajusta el contenido.'),{status:422});
  for(let size=start;size>=minSize;size-=0.5){
    const lines=wrapText(font,text,size,box.width),lineHeight=size*1.22;
    if(lines.length<=maxLines && lines.length*lineHeight<=box.height && lines.every(line=>font.widthOfTextAtSize(line,size)<=box.width))return {size,lines,lineHeight};
  }
  throw Object.assign(new Error('El texto no cabe en el campo del certificado. Amplía su ancho/alto o ajusta el contenido.'),{status:422});
}

function alignedX(font, line, size, box, align) {
  const lineWidth = font.widthOfTextAtSize(line, size);
  if (align === 'right') return box.x + Math.max(0, box.width - lineWidth);
  if (align === 'center') return box.x + Math.max(0, (box.width - lineWidth) / 2);
  return box.x;
}

function drawTextField(page, fonts, field, text, options = {}) {
  if (!field?.enabled || !String(text || '').trim()) return;
  const box = boxFromPercent(page, field);
  const font = fontForStyle(fonts, field.style);
  const supported=new Set(font.getCharacterSet());
  if([...String(text)].some(char=>char!=='\n' && char!=='\r' && !supported.has(char.codePointAt(0))))throw Object.assign(new Error('El certificado contiene caracteres que la fuente no admite. Usa una transcripción compatible.'),{status:422});
  const fitted = fittedLines(font, String(text), field.size, box, options);
  const color = hexToRgb(field.color);
  const totalHeight = fitted.lines.length * fitted.lineHeight;
  const topInset = options.vertical === 'top' ? 0 : Math.max(0, (box.height - totalHeight) / 2);
  let cursor = box.top - topInset - fitted.size;
  for (const line of fitted.lines) {
    if (cursor < box.y - 1) break;
    page.drawText(line, {
      x: alignedX(font, line, fitted.size, box, field.align),
      y: cursor,
      size: fitted.size,
      font,
      color
    });
    cursor -= fitted.lineHeight;
  }
}

function drawContentField(page, fonts, field, lessons) {
  if(!field?.enabled)return;
  const rows=(lessons||[]).map((lesson,index)=>`${index+1}. ${lesson.title}`);
  if(!rows.length)return drawTextField(page,fonts,field,'Sin clases registradas',{vertical:'top'});
  const maxRows=4*Math.floor(boxFromPercent(page,field).height/(7*1.22));
  if(rows.length>maxRows)throw Object.assign(new Error('El temario supera la capacidad del reverso. Amplía el campo Contenido o acorta el temario.'),{status:422});
  // Keep exactly two A4 pages and try columns before ever omitting lesson titles.
  for(let columns=1;columns<=4;columns++){
    const gap=2, width=(field.width-gap*(columns-1))/columns;
    if(width<5)break;
    const perColumn=Math.ceil(rows.length/columns), plans=[];
    try{
      for(let col=0;col<columns;col++){
        const text=rows.slice(col*perColumn,(col+1)*perColumn).join('\n');if(!text)continue;
        const boxField={...field,x:field.x+col*(width+gap),width};
        fittedLines(fontForStyle(fonts,field.style),text,field.size,boxFromPercent(page,boxField),{minSize:7});plans.push({boxField,text});
      }
    }catch(error){if(error.status===422)continue;throw error;}
    for(const plan of plans)drawTextField(page,fonts,plan.boxField,plan.text,{vertical:'top'});
    return;
  }
  throw Object.assign(new Error('El temario completo no cabe en el reverso. Amplía el campo Contenido o acorta los títulos. No se ha recortado el certificado.'),{status:422});
}

function drawFallbackFront(page, fonts, academyName) {
  const width = page.getWidth();
  const height = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(.98, .99, 1) });
  page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44, borderColor: rgb(.31, .27, .9), borderWidth: 2 });
  page.drawText(academyName || 'AcademiaVE', { x: 56, y: height - 70, size: 18, font: fonts.bold, color: rgb(.12, .14, .2) });
  page.drawText('CERTIFICADO', { x: 56, y: height - 118, size: 28, font: fonts.bold, color: rgb(.12, .14, .2) });
}

function drawFallbackBack(page, fonts) {
  const width = page.getWidth();
  const height = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(.985, .985, .99) });
  page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44, borderColor: rgb(.31, .27, .9), borderWidth: 2 });
  page.drawText('DETALLE ACADÉMICO', { x: 56, y: height - 70, size: 22, font: fonts.bold, color: rgb(.12, .14, .2) });
}

function createCertificateService(db, settings, certificateLayout) {
  async function renderPdf({ certificate, course, lessons, snapshot }) {
    const pdf = await PDFDocument.create();
    const width = 841.89;
    const height = 595.28;
    const front = pdf.addPage([width, height]);
    const back = pdf.addPage([width, height]);
    pdf.registerFontkit(require('@pdf-lib/fontkit'));
    const regular=fs.readFileSync(path.join(config.publicDir,'assets/fonts/DejaVuSans.ttf'));
    const bold=fs.readFileSync(path.join(config.publicDir,'assets/fonts/DejaVuSans-Bold.ttf'));
    const fonts={regular:await pdf.embedFont(regular,{subset:true}),bold:await pdf.embedFont(bold,{subset:true})};
    // Oblique fonts are embedded independently; do not depend on browser synthesis.
    fonts.italic=await pdf.embedFont(fs.readFileSync(path.join(config.publicDir,'assets/fonts/DejaVuSans-Oblique.ttf')),{subset:true});
    fonts.boldItalic=await pdf.embedFont(fs.readFileSync(path.join(config.publicDir,'assets/fonts/DejaVuSans-BoldOblique.ttf')),{subset:true});

    const frontUrl = snapshot?.front_url || settings.get('certificate_front_url', '') || '/uploads/certificates/demo-front.png';
    const backUrl = snapshot?.back_url || settings.get('certificate_back_url', '') || '/uploads/certificates/demo-back.png';
    const hasFront = await embedTemplate(pdf, front, await loadTemplate(frontUrl));
    const hasBack = await embedTemplate(pdf, back, await loadTemplate(backUrl));
    if (!hasFront) drawFallbackFront(front, fonts, settings.get('academy_name', 'AcademiaVE'));
    if (!hasBack) drawFallbackBack(back, fonts);

    const layout = snapshot?.layout || certificateLayout.get();
    const duration = `${Number(course?.duration_hours || 0)} horas`;
    const date = formatDate(certificate.issued_at);

    // La plantilla queda intacta: sólo se superponen los campos dinámicos configurados por el administrador.
    drawTextField(front, fonts, layout.front.student_name, certificate.student_name, { minSize: 7 });
    drawTextField(front, fonts, layout.front.course_name, certificate.course_name, { minSize: 7 });
    drawTextField(front, fonts, layout.front.duration, duration, { minSize: 7 });
    drawTextField(front, fonts, layout.front.date, date, { minSize: 7 });
    drawTextField(front, fonts, layout.front.code, certificate.code, { minSize: 7 });

    drawContentField(back, fonts, layout.back.content, lessons);
    drawTextField(back, fonts, layout.back.duration, duration, { minSize: 7 });
    drawTextField(back, fonts, layout.back.code, certificate.code, { minSize: 7 });

    return Buffer.from(await pdf.save());
  }

  function snapshotCourse(user,course){
    return {version:1,student_name:user.name,course_name:course.name,duration_hours:course.duration_hours,lessons:db.prepare("SELECT title FROM lessons WHERE course_id=? AND status='published' ORDER BY sort_order,id").all(course.id),layout:certificateLayout.get(),front_url:settings.get('certificate_front_url'),back_url:settings.get('certificate_back_url'),academy_name:settings.get('academy_name')};
  }
  async function createPdf(certificate) {
    const raw=db.prepare('SELECT snapshot_json FROM certificates WHERE code=?').get(certificate.code)?.snapshot_json;
    const snapshot=raw?JSON.parse(raw):null;
    const course=snapshot || db.prepare('SELECT duration_hours FROM courses WHERE id=?').get(certificate.course_id) || {duration_hours:0};
    const lessons=snapshot?.lessons || db.prepare("SELECT title FROM lessons WHERE course_id=? AND status='published' ORDER BY sort_order,id").all(certificate.course_id);
    const data=snapshot?{...certificate,student_name:snapshot.student_name,course_name:snapshot.course_name}:certificate;
    return renderPdf({certificate:data,course,lessons,snapshot});
  }

  async function createPreviewPdf() {
    return renderPdf({
      certificate: {
        student_name: 'María Fernanda Rojas',
        course_name: 'Marketing Digital Estratégico',
        issued_at: new Date().toISOString(),
        code: 'AVE-DEMO-2026-001'
      },
      course: { duration_hours: 40 },
      lessons: [
        { title: 'Introducción y fundamentos' },
        { title: 'Estrategia y herramientas principales' },
        { title: 'Aplicaciones prácticas' },
        { title: 'Proyecto final y buenas prácticas' }
      ]
    });
  }

  return { createPdf, createPreviewPdf, formatDate, snapshotCourse };
}

module.exports = { createCertificateService, formatDate, wrapText, fittedLines, boxFromPercent };
