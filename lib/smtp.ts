import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { getSmtpEnv } from "@/lib/env";

interface SendSmtpEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";

function buildTransporterKey(config: ReturnType<typeof getSmtpEnv>): string {
  if (!config) {
    return "";
  }

  return [
    config.host,
    String(config.port),
    String(config.secure),
    config.user,
    config.fromEmail,
  ].join("|");
}

function getTransporter(): { transporter: Transporter; fromName: string; fromEmail: string } {
  const config = getSmtpEnv();

  if (!config) {
    throw new Error("Custom SMTP is not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM_EMAIL.");
  }

  const transporterKey = buildTransporterKey(config);

  if (!cachedTransporter || cachedTransporterKey !== transporterKey) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    cachedTransporterKey = transporterKey;
  }

  return {
    transporter: cachedTransporter,
    fromName: config.fromName,
    fromEmail: config.fromEmail,
  };
}

export async function sendSmtpEmail(input: SendSmtpEmailInput): Promise<void> {
  const { transporter, fromName, fromEmail } = getTransporter();

  await transporter.sendMail({
    from: `${fromName} <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
