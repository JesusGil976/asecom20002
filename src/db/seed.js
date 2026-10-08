const bcrypt = require('bcryptjs');
const { cleanText } = require('../utils/text');

const DEFAULT_SETTINGS = {
  academy_name: process.env.ACADEMY_NAME || 'AcademiaVE',
  tagline: process.env.ACADEMY_TAGLINE || 'Aprende hoy. Transforma tu mañana.',
  hero_text: process.env.ACADEMY_HERO_TEXT || 'Cursos prácticos de IA, marketing y habilidades digitales.',
  hero_badge: 'Formación online',
  hero_cta: 'Ver cursos',
  hero_secondary_cta: 'Crear cuenta',
  hero_card_title: 'Aprende a tu ritmo',
  hero_card_text: 'Video, teoría, materiales y progreso guardado en tu cuenta.',
  catalog_eyebrow: 'CATÁLOGO',
  catalog_title: 'Cursos destacados',
  process_title: 'Cómo funciona',
  process_step1_title: 'Crea tu cuenta',
  process_step1_text: 'Regístrate y guarda tu progreso en un solo lugar.',
  process_step2_title: 'Realiza el pago',
  process_step2_text: 'Paga por Pago Móvil y envía la referencia junto a tus datos.',
  process_step3_title: 'Aprende',
  process_step3_text: 'Cuando se apruebe, tendrás acceso al aula y al material.',
  hero_image_url: '', logo_url: '', favicon_url: '',
  primary_color: '#006b5f', secondary_color: '#a9c7b0', accent_color: '#142d2a',
  page_background: '#f7f8f5', surface_color: '#ffffff',
  about_title: 'Sobre nosotros',
  about_text: 'Somos una academia enfocada en formación práctica y accesible.',
  about_image_url: '', about_visible: '1',
  location_1: process.env.LOCATION_1 || '', location_2: process.env.LOCATION_2 || '', location_3: '',
  location_map_1: '', location_map_2: '', location_map_3: '',
  locations_title: 'Nuestras sedes', locations_text: 'Conoce nuestras ubicaciones y canales de atención.',
  support_email: process.env.SUPPORT_EMAIL || '', whatsapp: process.env.SUPPORT_WHATSAPP || '',
  instagram_url: '', facebook_url: '', tiktok_url: '',
  footer_text: 'Formación práctica para el mundo digital.',
  copyright_text: `© ${new Date().getFullYear()} AcademiaVE. Todos los derechos reservados.`,
  privacy_text: 'Describe aquí cómo recopilas, utilizas y proteges los datos personales de los usuarios.',
  terms_text: 'Describe aquí las condiciones de uso, pagos, acceso a cursos, propiedad intelectual y políticas aplicables.',
  login_label: 'Entrar', register_label: 'Crear cuenta',
  payment_bank: process.env.PAYMENT_BANK || 'Banco de Venezuela',
  payment_phone: process.env.PAYMENT_PHONE || '0414-1234567',
  payment_document: process.env.PAYMENT_DOCUMENT || 'V-12345678',
  exchange_rate: process.env.EXCHANGE_RATE || '0',
  certificate_front_url: '/uploads/certificates/default-front.png',
  certificate_back_url: '/uploads/certificates/default-back.png',
  certificate_name_y: '56', certificate_course_y: '34', certificate_meta_y: '18',
  certificate_name_size: '30', certificate_course_size: '18', certificate_meta_size: '9',
  certificate_name_color: '#0f172a', certificate_course_color: '#334155', certificate_meta_color: '#475569'
};

const DEFAULT_TOKENS = {
  primary: '#006b5f', primary_dark: '#005247', secondary: '#a9c7b0', accent: '#142d2a',
  background: '#f7f8f5', surface: '#ffffff', surface_muted: '#edf1eb', text: '#142d2a', text_muted: '#566662',
  border: '#dce3dd', success: '#15803d', warning: '#b45309', danger: '#b91c1c',
  font_family: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius_sm: '8px', radius_md: '16px', radius_lg: '24px', shadow: '0 12px 36px rgba(15, 23, 42, .08)',
  content_width: '1180px', density: 'comfortable', button_style: 'rounded'
};

function seedSettings(db) {
  const insert = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insert.run(key, String(value ?? ''));
}

function seedDesignTokens(db) {
  const getSetting = db.prepare('SELECT value FROM site_settings WHERE key = ?');
  const derived = {
    ...DEFAULT_TOKENS,
    primary: getSetting.get('primary_color')?.value || DEFAULT_TOKENS.primary,
    secondary: getSetting.get('secondary_color')?.value || DEFAULT_TOKENS.secondary,
    accent: getSetting.get('accent_color')?.value || DEFAULT_TOKENS.accent,
    background: getSetting.get('page_background')?.value || DEFAULT_TOKENS.background,
    surface: getSetting.get('surface_color')?.value || DEFAULT_TOKENS.surface
  };
  const insert = db.prepare('INSERT OR IGNORE INTO design_tokens (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(derived)) insert.run(key, value);
}

function seedLocations(db) {
  if (db.prepare('SELECT COUNT(*) count FROM locations').get().count > 0) return;
  const setting = key => db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key)?.value || '';
  const insert = db.prepare('INSERT INTO locations (name, address, description, map_embed_url, sort_order) VALUES (?, ?, ?, ?, ?)');
  for (let i = 1; i <= 3; i += 1) {
    const address = cleanText(setting(`location_${i}`), 500);
    if (!address) continue;
    insert.run(`Sede ${i}`, address, '', cleanText(setting(`location_map_${i}`), 2000), i - 1);
  }
}

function seedNavigation(db) {
  if (db.prepare('SELECT COUNT(*) count FROM navigation_items').get().count > 0) return;
  const insert = db.prepare('INSERT INTO navigation_items (label, href, location, sort_order) VALUES (?, ?, ?, ?)');
  [['Inicio','/'],['Cursos','/catalogo'],['Nosotros','/#nosotros'],['Sedes','/#sedes']].forEach((item, i) => insert.run(item[0], item[1], 'header', i));
  [['Cursos','/catalogo'],['Privacidad','/privacidad'],['Términos','/terminos']].forEach((item, i) => insert.run(item[0], item[1], 'footer', i));
}

function sectionSettings(db, type) {
  const get = key => db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key)?.value || '';
  const map = {
    hero: { badge: get('hero_badge'), title: get('tagline'), text: get('hero_text'), primaryCta: get('hero_cta'), secondaryCta: get('hero_secondary_cta'), imageUrl: get('hero_image_url') },
    featured_courses: { eyebrow: get('catalog_eyebrow'), title: get('catalog_title'), limit: 9 },
    stats: { items: [{ value: '100%', label: 'Online' }, { value: '24/7', label: 'Acceso al contenido' }, { value: 'A tu ritmo', label: 'Aprendizaje flexible' }] },
    process: { title: get('process_title'), steps: [1,2,3].map(i => ({ title: get(`process_step${i}_title`), text: get(`process_step${i}_text`) })) },
    about: { title: get('about_title'), text: get('about_text'), imageUrl: get('about_image_url') },
    locations: { title: get('locations_title'), text: get('locations_text') },
    cta: { title: 'Empieza a aprender hoy', text: 'Explora el catálogo y elige tu próximo curso.', buttonLabel: 'Explorar cursos', href: '/catalogo' }
  };
  return map[type] || {};
}

function seedHomePage(db) {
  let page = db.prepare("SELECT * FROM pages WHERE slug = 'home'").get();
  if (!page) {
    const result = db.prepare("INSERT INTO pages (slug, name) VALUES ('home','Inicio')").run();
    page = db.prepare('SELECT * FROM pages WHERE id = ?').get(result.lastInsertRowid);
  }
  if (db.prepare('SELECT COUNT(*) count FROM page_versions WHERE page_id = ?').get(page.id).count > 0) return;

  const versionResult = db.prepare("INSERT INTO page_versions (page_id, status, version_number, published_at) VALUES (?, 'published', 1, CURRENT_TIMESTAMP)").run(page.id);
  const versionId = Number(versionResult.lastInsertRowid);
  const insertSection = db.prepare(`INSERT INTO page_sections (version_id, section_key, section_type, variant, enabled, sort_order, settings_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const sections = [
    ['hero','hero','split',1],
    ['featured','featured_courses','cards',1],
    ['stats','stats','inline',1],
    ['process','process','steps',1],
    ['about','about','split',1],
    ['locations','locations','grid',1],
    ['cta','cta','banner',1]
  ];
  sections.forEach((entry, index) => insertSection.run(versionId, entry[0], entry[1], entry[2], entry[3], index, JSON.stringify(sectionSettings(db, entry[1]))));
  db.prepare('UPDATE pages SET published_version_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(versionId, page.id);
}

function seedCourses(db) {
  if (db.prepare('SELECT COUNT(*) count FROM courses').get().count > 0) return;
  const addCourse = db.prepare(`INSERT INTO courses (slug,name,price_usd,icon,description,long_description,category,level,duration_hours,status,featured)
    VALUES (@slug,@name,@price_usd,@icon,@description,@long_description,@category,@level,@duration_hours,'published',1)`);
  const addLesson = db.prepare(`INSERT INTO lessons (course_id,title,description,content,sort_order,is_free) VALUES (?,?,?,?,?,?)`);
  const rows = [
    { slug:'ia', name:'Curso de IA', price_usd:30, icon:'IA', description:'Aprende fundamentos y aplicaciones prácticas de inteligencia artificial.', long_description:'Un recorrido práctico por inteligencia artificial, modelos generativos, prompting y herramientas aplicables desde el primer día.', category:'Inteligencia Artificial', level:'Principiante', duration_hours:4,
      lessons:[['Introducción a la Inteligencia Artificial','Conceptos básicos y principales aplicaciones.','Qué es la IA, qué problemas resuelve y cómo usarla de forma responsable.',1],['Cómo funcionan los modelos','Datos, entrenamiento e inferencia.','Entiende los conceptos esenciales detrás de los modelos actuales.',0],['Ingeniería de prompts','Instrucciones más efectivas.','Aprende estructuras de prompts y técnicas iterativas.',0]] },
    { slug:'pack-ia-marketing', name:'Pack IA + Marketing', price_usd:50, icon:'DIGITAL', description:'IA y marketing digital para crear contenido y vender productos o servicios.', long_description:'Combina IA y marketing digital para estructurar ofertas, captar clientes y automatizar procesos repetitivos.', category:'IA + Marketing', level:'Principiante / Intermedio', duration_hours:8,
      lessons:[['Fundamentos de estrategia digital','Objetivos, audiencia y propuesta de valor.','Construye una base estratégica antes de ejecutar campañas.',1],['Contenido asistido por IA','Sistema práctico de producción.','Diseña un flujo repetible de creación y revisión de contenido.',0],['Conversión y seguimiento','Mide y mejora resultados.','Define métricas y mejora tus acciones con ciclos de aprendizaje.',0]] }
  ];
  const tx = db.transaction(() => {
    for (const course of rows) {
      const id = Number(addCourse.run(course).lastInsertRowid);
      course.lessons.forEach((lesson, index) => addLesson.run(id, lesson[0], lesson[1], lesson[2], index, lesson[3]));
    }
  });
  tx();
}

function seedAdmin(db) {
  if (db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()) return;
  const email = String(process.env.ADMIN_EMAIL || 'admin@academiave.local').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || 'CambiaEstaClave123!');
  const name = String(process.env.ADMIN_NAME || 'Administrador').trim();
  db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')").run(name, email, bcrypt.hashSync(password, 12));
}

function seedAll(db) {
  seedSettings(db);
  seedDesignTokens(db);
  seedLocations(db);
  seedNavigation(db);
  seedHomePage(db);
  seedCourses(db);
  seedAdmin(db);
}

module.exports = { seedAll, DEFAULT_SETTINGS, DEFAULT_TOKENS };
