import nodemailer from "nodemailer";

export function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  return base.replace(/\/$/, "");
}

export function isEmailConfigured() {
  const host = process.env.EMAIL_SERVER_HOST;
  if (!host || host === "smtp.example.com") return false;

  return Boolean(
    process.env.EMAIL_FROM &&
      process.env.EMAIL_SERVER_USER &&
      process.env.EMAIL_SERVER_PASSWORD
  );
}

function getTransporter() {
  if (!isEmailConfigured()) {
    throw new Error("E-Mail-Versand ist nicht konfiguriert.");
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}

export async function sendLoginLinkEmail(to: string, loginUrl: string) {
  const subject = "Dein Login-Link für OKR für Paare";
  const text = `Du wurdest für die OKR-für-Paare Beta eingeladen oder bist bereits registriert.\n\nMelde dich hier an: ${loginUrl}\n\nDer Link läuft in 24 Stunden ab.`;
  const html = `<p>Du wurdest für die <strong>OKR für Paare</strong> Beta eingeladen oder bist bereits registriert.</p><p><a href="${loginUrl}">Jetzt anmelden</a></p><p>Der Link läuft in 24 Stunden ab.</p>`;

  await sendMail({ to, subject, text, html });
}

export async function sendPartnerInviteEmail(to: string, inviteUrl: string) {
  const subject = "Einladung: OKR für Paare";
  const text = `Du wurdest eingeladen, einem Couple beizutreten.\n\nHier ist dein Link: ${inviteUrl}`;
  const html = `<p>Du wurdest eingeladen, einem Couple beizutreten.</p><p><a href="${inviteUrl}">Zum Couple beitreten</a></p>`;

  await sendMail({ to, subject, text, html });
}
