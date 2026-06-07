/**
 * WelcomeEmail — se envía cuando un usuario completa su registro.
 *
 * Uso de ejemplo (server-side):
 *   import { sendEmail } from "@/lib/email";
 *   import { WelcomeEmail } from "@/emails/welcome";
 *
 *   await sendEmail({
 *     to: "usuario@email.com",
 *     subject: "¡Bienvenido/a a mangui!",
 *     react: <WelcomeEmail name="Juan" />,
 *   });
 */
import { Button, Heading, Text } from "@react-email/components";
import { BaseEmail } from "./_layout";

interface WelcomeEmailProps {
  name?: string;
}

const styles = {
  heading: {
    color: "#1a1a1a",
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 16px",
  },
  body: {
    color: "#374151",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 12px",
  },
  highlight: {
    color: "#F97316",
    fontWeight: "600",
  },
  buttonContainer: {
    margin: "28px 0 8px",
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: "#84CC16",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: "700",
    padding: "12px 28px",
    textDecoration: "none",
  },
};

const APP_URL = "https://www.mangui.com.ar/inicio";

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  const firstName = name ? name.split(" ")[0] : null;
  const greeting = firstName ? `¡Hola, ${firstName}!` : "¡Hola!";

  return (
    <BaseEmail preview="¡Bienvenido/a a mangui! Tu billetera personal ya está lista.">
      <Heading style={styles.heading}>{greeting} 👋</Heading>

      <Text style={styles.body}>
        Tu cuenta en{" "}
        <span style={styles.highlight}>mangui</span> ya está lista.
        Empezá a tomar el control de tus finanzas personales hoy mismo.
      </Text>

      <Text style={styles.body}>
        Con mangui podés registrar movimientos, organizar tus gastos por
        categoría, hacer seguimiento de tus metas y ver cómo evoluciona tu
        economía mes a mes — todo en pesos y pensado para Argentina.
      </Text>

      <div style={styles.buttonContainer}>
        <Button href={APP_URL} style={styles.button}>
          Ir a mi cuenta →
        </Button>
      </div>
    </BaseEmail>
  );
}
