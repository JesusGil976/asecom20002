const nodemailer = require("nodemailer");
const { escapeHtml } = require("../utils/text");

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.MAIL_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: String(process.env.MAIL_SECURE || "false") === "true",
    auth: process.env.MAIL_USER
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
      : undefined,
  });
  return transporter;
}

function passwordResetMessage({ name, resetUrl, academyName = "AcademiaVE" }) {
  const academy = escapeHtml(academyName),
    greeting = escapeHtml(name),
    url = escapeHtml(resetUrl);
  return {
    subject: `Recupera tu acceso a ${academyName}`,
    text: `Hola ${name}.\n\nRecibimos una solicitud para restablecer tu contraseña en ${academyName}.\nAbre este enlace: ${resetUrl}\n\nEl enlace caduca en 30 minutos y sólo puede usarse una vez. Si no solicitaste este cambio, ignora este correo; tu contraseña seguirá igual.\n\n${academyName}`,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recupera tu acceso</title></head><body style="margin:0;padding:0;background:#f2f6f4;font-family:Arial,Helvetica,sans-serif;color:#183c35"><div style="display:none;max-height:0;overflow:hidden;opacity:0">Restablece tu contraseña. Tu enlace caduca en 30 minutos.</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6f4"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dce8e2;border-radius:16px"><tr><td style="padding:28px 32px;background:#006b5f;color:#ffffff;border-radius:16px 16px 0 0"><p style="margin:0;font-size:22px;font-weight:bold">${academy}</p><p style="margin:8px 0 0;font-size:14px;color:#d7f3e8">Tu aprendizaje continúa aquí</p></td></tr><tr><td style="padding:32px"><p style="margin:0 0 12px;font-size:14px;color:#507468">RECUPERACIÓN DE ACCESO</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.25;color:#183c35">Vuelve a tu aula</h1><p style="font-size:16px;line-height:1.6">Hola, ${greeting}.</p><p style="font-size:16px;line-height:1.6">Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón para elegir una nueva y continuar con tus clases.</p><table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td bgcolor="#006b5f" style="border-radius:8px"><a href="${url}" style="display:inline-block;padding:16px 24px;border:1px solid #006b5f;border-radius:8px;color:#ffffff;background:#006b5f;font-size:16px;font-weight:bold;text-decoration:none">Restablecer contraseña</a></td></tr></table><p style="font-size:14px;line-height:1.6;color:#507468"><strong>Disponible durante 30 minutos.</strong><br>Este enlace sólo puede utilizarse una vez.</p><p style="font-size:14px;line-height:1.6;color:#507468">Si no solicitaste este cambio, puedes ignorar el correo. Tu contraseña seguirá igual.</p><hr style="border:0;border-top:1px solid #e2eae5;margin:24px 0"><p style="font-size:12px;line-height:1.6;color:#507468">Si el botón no funciona, copia esta dirección en tu navegador:</p><p style="font-size:12px;line-height:1.6;word-break:break-all"><a href="${url}" style="color:#006b5f;overflow-wrap:anywhere">${url}</a></p></td></tr></table><p style="font-size:12px;color:#688477;margin:20px 0 0">${academy} · Correo automático de recuperación</p></td></tr></table></body></html>`,
  };
}

async function sendPasswordResetEmail({ to, name, resetUrl, academyName }) {
  const mailer = getTransporter();
  if (!mailer) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Servicio de correo no configurado.");
    console.log(
      JSON.stringify({
        level: "warn",
        event: "password_reset_mail_skipped",
        to,
      }),
    );
    return;
  }
  await mailer.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    ...passwordResetMessage({ name, resetUrl, academyName }),
  });
}

module.exports = { sendPasswordResetEmail, passwordResetMessage };
