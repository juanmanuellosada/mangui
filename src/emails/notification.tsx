/**
 * NotificationEmail — template genérico para emails transaccionales/notificaciones.
 *
 * Uso de ejemplo (server-side):
 *   import { sendEmail } from "@/lib/email";
 *   import { NotificationEmail } from "@/emails/notification";
 *
 *   await sendEmail({
 *     to: "usuario@email.com",
 *     subject: "Tu meta está casi completa",
 *     react: (
 *       <NotificationEmail
 *         title="¡Casi llegás a tu meta!"
 *         body="Completaste el 90% de tu meta de ahorro. Seguí así."
 *         ctaLabel="Ver mis metas"
 *         ctaUrl="https://www.mangui.com.ar/metas"
 *       />
 *     ),
 *   });
 */
import { Button, Heading, Text } from "@react-email/components";
import { BaseEmail } from "./_layout";

interface NotificationEmailProps {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

const styles = {
  heading: {
    color: "#1a1a1a",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 16px",
  },
  body: {
    color: "#374151",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 8px",
  },
  buttonContainer: {
    margin: "28px 0 8px",
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: "#F97316",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "700",
    padding: "12px 28px",
    textDecoration: "none",
  },
};

export function NotificationEmail({
  title,
  body,
  ctaLabel,
  ctaUrl,
}: NotificationEmailProps) {
  return (
    <BaseEmail preview={title}>
      <Heading style={styles.heading}>{title}</Heading>

      <Text style={styles.body}>{body}</Text>

      {ctaLabel && ctaUrl && (
        <div style={styles.buttonContainer}>
          <Button href={ctaUrl} style={styles.button}>
            {ctaLabel}
          </Button>
        </div>
      )}
    </BaseEmail>
  );
}
