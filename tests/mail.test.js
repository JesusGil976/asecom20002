const test = require("node:test"),
  assert = require("node:assert/strict");
const { passwordResetMessage } = require("../src/services/mail");
test("correo de recuperación incluye botón, alternativa de texto, vencimiento y marca escapada", () => {
  const message = passwordResetMessage({
    name: "María <img src=x onerror=alert(1)>",
    academyName: "Academia & Formación",
    resetUrl: "https://academy.example/reset-password?token=fixture",
  });
  assert.match(message.subject, /Academia & Formación/);
  assert.match(message.text, /30 minutos/);
  assert.match(message.text, /token=fixture/);
  assert.match(message.html, /role="presentation"/);
  assert.match(message.html, /Restablecer contraseña/);
  assert.match(message.html, /Academia &amp; Formación/);
  assert.ok(!message.html.includes("<img src=x"));
  assert.match(message.html, /&lt;img/);
});
