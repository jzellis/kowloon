// methods/email/index.js
// Thin nodemailer wrapper. In dev (no SMTP host configured), uses Ethereal
// and logs a preview URL to the console instead of delivering.

import nodemailer from "nodemailer";
import { getSetting } from "#methods/settings/cache.js";
import logger from "#methods/utils/logger.js";

let _etherealTransport = null;

async function getTransport() {
  const cfg = getSetting("emailServer") || {};
  const host = cfg.host;
  const hasSmtp = host && host !== "localhost" && host !== "";

  if (!hasSmtp) {
    if (!_etherealTransport) {
      const testAccount = await nodemailer.createTestAccount();
      _etherealTransport = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      logger.info(`[email] No SMTP configured — using Ethereal (${testAccount.user})`);
    }
    return { transport: _etherealTransport, preview: true };
  }

  const transport = nodemailer.createTransport({
    host,
    port: cfg.port || 587,
    secure: (cfg.port || 587) === 465,
    auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
  });

  return { transport, preview: false };
}

export async function sendEmail({ to, subject, html, text }) {
  const domain = getSetting("domain") || "localhost";
  const adminEmail = getSetting("adminEmail") || `noreply@${domain}`;
  const siteName = getSetting("profile")?.name || "Kowloon";

  const { transport, preview } = await getTransport();

  const info = await transport.sendMail({
    from: `"${siteName}" <${adminEmail}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });

  if (preview) {
    logger.info(`[email] Preview: ${nodemailer.getTestMessageUrl(info)}`);
  }

  return info;
}
