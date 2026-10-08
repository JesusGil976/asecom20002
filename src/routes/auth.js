const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { normalizeEmail, cleanText } = require("../utils/text");
const {
  authLimiter,
  passwordResetRequestLimiter,
  passwordResetSubmitLimiter,
} = require("../middleware/rate-limits");
const { asyncHandler } = require("../utils/http");
const { sendPasswordResetEmail } = require("../services/mail");
const { config } = require("../config");

function createAuthRoutes({ db, auth, audit }) {
  const router = express.Router();
  const publicUser = (user) =>
    user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
        }
      : null;
  const resetHash = (token) =>
    crypto.createHash("sha256").update(token).digest("hex");
  const baseUrl = (req) =>
    config.publicUrl || `${req.protocol}://${req.get("host")}`;

  router.post(
    "/register",
    authLimiter,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const name = cleanText(req.body.name, 120);
      const email = normalizeEmail(req.body.email);
      const password = String(req.body.password || "");
      if (name.length < 2)
        throw Object.assign(new Error("Indica tu nombre."), { status: 400 });
      if (!/^\S+@\S+\.\S+$/.test(email))
        throw Object.assign(new Error("Correo electrónico no válido."), {
          status: 400,
        });
      if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72)
        throw Object.assign(
          new Error(
            "La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.",
          ),
          { status: 400 },
        );
      if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
        throw Object.assign(new Error("Ya existe una cuenta con ese correo."), {
          status: 409,
        });
      const result = db
        .prepare(
          "INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'student')",
        )
        .run(name, email, await bcrypt.hash(password, 12));
      const user = db
        .prepare(
          "SELECT id,name,email,role,session_version,created_at FROM users WHERE id=?",
        )
        .get(result.lastInsertRowid);
      await new Promise((resolve, reject) =>
        req.session.regenerate((err) => (err ? reject(err) : resolve())),
      );
      req.session.userId = user.id;
      req.session.sessionVersion = user.session_version;
      auth.ensureCsrf(req);
      audit.write({
        actorUserId: user.id,
        action: "auth.register",
        entityType: "user",
        entityId: user.id,
        ip: req.ip,
      });
      res
        .status(201)
        .json({ user: publicUser(user), csrfToken: req.session.csrfToken });
    }),
  );

  router.post(
    "/login",
    authLimiter,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const email = normalizeEmail(req.body.email);
      const password = String(req.body.password || "");
      const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
      if (!user || !(await bcrypt.compare(password, user.password_hash)))
        throw Object.assign(new Error("Correo o contraseña incorrectos."), {
          status: 401,
        });
      await new Promise((resolve, reject) =>
        req.session.regenerate((err) => (err ? reject(err) : resolve())),
      );
      req.session.userId = user.id;
      req.session.sessionVersion = user.session_version;
      auth.ensureCsrf(req);
      audit.write({
        actorUserId: user.id,
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
        ip: req.ip,
      });
      res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
    }),
  );

  router.post(
    "/forgot-password",
    passwordResetRequestLimiter,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const generic =
        "Si existe una cuenta asociada a ese correo, recibirás un enlace para recuperar tu contraseña. Si no lo recibes, revisa tu carpeta de spam o correo no deseado.";
      const email = normalizeEmail(req.body.email);
      const user = db
        .prepare("SELECT id,name,email FROM users WHERE email=?")
        .get(email);
      if (!user) return res.json({ ok: true, message: generic });
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = resetHash(token);
      const expires = Date.now() + 30 * 60 * 1000;
      db.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").run(
        user.id,
      );
      db.prepare(
        "INSERT INTO password_reset_tokens (user_id,token_hash,expires_at_ms) VALUES (?,?,?)",
      ).run(user.id, tokenHash, expires);
      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          academyName:
            db
              .prepare(
                "SELECT value FROM site_settings WHERE key='academy_name'",
              )
              .get()?.value || "AcademiaVE",
          resetUrl: `${baseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`,
        });
      } catch (error) {
        db.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").run(
          tokenHash,
        );
        require("../utils/logger").error("password_reset_delivery_failed", {
          requestId: req.id,
        });
      }
      audit.write({
        actorUserId: user.id,
        action: "auth.password_reset_requested",
        entityType: "user",
        entityId: user.id,
        ip: req.ip,
      });
      res.json({ ok: true, message: generic });
    }),
  );

  router.post(
    "/reset-password",
    passwordResetSubmitLimiter,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const token = cleanText(req.body.token, 256);
      const password = String(req.body.password || "");
      const confirm = String(req.body.confirmPassword || "");
      if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72)
        throw Object.assign(
          new Error(
            "La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.",
          ),
          { status: 400 },
        );
      if (password !== confirm)
        throw Object.assign(new Error("Las contraseñas no coinciden."), {
          status: 400,
        });
      const reset = db
        .prepare(
          "SELECT * FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL",
        )
        .get(resetHash(token));
      if (!reset || Number(reset.expires_at_ms) <= Date.now())
        throw Object.assign(
          new Error("El enlace de recuperación es inválido o ya expiró."),
          { status: 400 },
        );
      const passwordHash = await bcrypt.hash(password, 12);
      db.transaction(() => {
        const live = db
          .prepare(
            "SELECT id FROM password_reset_tokens WHERE id=? AND used_at IS NULL AND expires_at_ms>?",
          )
          .get(reset.id, Date.now());
        if (!live)
          throw Object.assign(
            new Error("El enlace de recuperación es inválido o ya expiró."),
            { status: 400 },
          );
        db.prepare(
          "UPDATE users SET password_hash=?, session_version=session_version+1 WHERE id=?",
        ).run(passwordHash, reset.user_id);
        db.prepare(
          "UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(reset.id);
        db.prepare(
          "DELETE FROM password_reset_tokens WHERE user_id=? AND id!=?",
        ).run(reset.user_id, reset.id);
      })();
      audit.write({
        actorUserId: reset.user_id,
        action: "auth.password_reset_completed",
        entityType: "user",
        entityId: reset.user_id,
        ip: req.ip,
      });
      await new Promise((resolve) => req.session.destroy(() => resolve()));
      res.clearCookie("connect.sid");
      res.json({
        ok: true,
        message:
          "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
      });
    }),
  );

  router.post(
    "/logout",
    auth.requireAuth,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const id = req.user.id;
      audit.write({
        actorUserId: id,
        action: "auth.logout",
        entityType: "user",
        entityId: id,
        ip: req.ip,
      });
      await new Promise((resolve, reject) =>
        req.session.destroy((err) => (err ? reject(err) : resolve())),
      );
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    }),
  );

  router.get("/me", (req, res) =>
    res.json({
      user: publicUser(req.user || null),
      csrfToken: auth.ensureCsrf(req),
    }),
  );
  return router;
}
module.exports = { createAuthRoutes };
