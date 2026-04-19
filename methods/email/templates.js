// methods/email/templates.js
// HTML email templates for invite and password reset emails.

import { getSetting } from "#methods/settings/cache.js";

function baseLayout(siteName, domain, content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: sans-serif; background: #f4f4f5; margin: 0; padding: 32px 16px; }
    .card { background: #fff; border-radius: 8px; max-width: 520px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 22px; margin: 0 0 16px; color: #111; }
    p { font-size: 15px; line-height: 1.6; color: #444; margin: 0 0 16px; }
    .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none;
           padding: 12px 24px; border-radius: 6px; font-size: 15px; font-weight: 600; }
    .muted { font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${siteName}</h1>
    ${content}
    <p class="muted">This email was sent by ${siteName} (${domain}). If you didn't expect it, you can ignore it.</p>
  </div>
</body>
</html>`;
}

export function inviteEmail({ inviteUrl, email, welcomeMessage, note }) {
  const domain = getSetting("domain") || "localhost";
  const siteName = getSetting("siteName") || "Kowloon";

  const greeting = welcomeMessage
    ? `<p>${welcomeMessage}</p>`
    : `<p>You've been invited to join <strong>${siteName}</strong>, a federated social network.</p>`;

  const noteHtml = note ? `<p><em>${note}</em></p>` : "";

  const content = `
    ${greeting}
    ${noteHtml}
    <p>Click the button below to create your account. This invite is for <code>${email}</code> only.</p>
    <p><a class="btn" href="${inviteUrl}">Accept Invitation</a></p>
    <p>Or copy this link:<br><code>${inviteUrl}</code></p>
  `;

  return {
    subject: `You're invited to ${siteName}`,
    html: baseLayout(siteName, domain, content),
  };
}

export function passwordResetEmail({ resetUrl }) {
  const domain = getSetting("domain") || "localhost";
  const siteName = getSetting("siteName") || "Kowloon";

  const content = `
    <p>We received a request to reset your password on <strong>${siteName}</strong>.</p>
    <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p><a class="btn" href="${resetUrl}">Reset Password</a></p>
    <p>Or copy this link:<br><code>${resetUrl}</code></p>
    <p>If you didn't request a password reset, you can ignore this email.</p>
  `;

  return {
    subject: `Reset your ${siteName} password`,
    html: baseLayout(siteName, domain, content),
  };
}
