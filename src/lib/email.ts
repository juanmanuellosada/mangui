"server-only";

import { render } from "@react-email/render";
import { Resend } from "resend";
import { type ReactNode } from "react";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "mangui <hola@mangui.com.ar>";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  /** React Email component. Will be rendered to HTML before sending. */
  react?: ReactNode;
  /** Pre-rendered HTML. Use when not using a React template. */
  html?: string;
  replyTo?: string | string[];
}

interface SendEmailResult {
  id?: string;
  error?: string;
}

/**
 * Send a transactional email via Resend.
 *
 * Pass either `react` (a React Email component) or `html` (pre-rendered HTML).
 * `react` is rendered to HTML server-side via @react-email/render before sending.
 *
 * Example:
 *   import { WelcomeEmail } from "@/emails/welcome";
 *   await sendEmail({
 *     to: "user@example.com",
 *     subject: "¡Bienvenido/a a mangui!",
 *     react: <WelcomeEmail name="Juan" />,
 *   });
 */
export async function sendEmail({
  to,
  subject,
  react,
  html,
  replyTo,
}: SendEmailOptions): Promise<SendEmailResult> {
  let resolvedHtml: string | undefined = html;

  if (react) {
    resolvedHtml = await render(react);
  }

  if (!resolvedHtml) {
    return { error: "Either `react` or `html` must be provided." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping email");
    return { error: "RESEND_API_KEY not configured" };
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: resolvedHtml,
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    console.error("[email] Resend error:", error);
    return { error: error.message };
  }

  return { id: data?.id };
}
