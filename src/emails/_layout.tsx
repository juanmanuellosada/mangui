import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { type ReactNode } from "react";

const LOGO_URL = "https://www.mangui.com.ar/logo-square.png";
const APP_URL = "https://www.mangui.com.ar";

const styles = {
  body: {
    backgroundColor: "#f9fafb",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: "0",
    padding: "0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    margin: "32px auto",
    maxWidth: "520px",
    padding: "0",
    border: "1px solid #e5e7eb",
  },
  header: {
    backgroundColor: "#ffffff",
    borderRadius: "12px 12px 0 0",
    borderBottom: "2px solid #84CC16",
    padding: "24px 40px",
    textAlign: "center" as const,
  },
  logoImg: {
    borderRadius: "10px",
    display: "inline-block",
  },
  wordmark: {
    color: "#1a1a1a",
    display: "inline-block",
    fontSize: "22px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
    marginLeft: "10px",
    verticalAlign: "middle",
  },
  wordmarkAccent: {
    color: "#F97316",
  },
  content: {
    padding: "32px 40px",
  },
  hr: {
    borderColor: "#e5e7eb",
    margin: "0",
  },
  footer: {
    color: "#9ca3af",
    fontSize: "12px",
    lineHeight: "1.6",
    padding: "20px 40px",
    textAlign: "center" as const,
  },
  footerLink: {
    color: "#9ca3af",
    textDecoration: "underline",
  },
};

interface BaseEmailProps {
  preview: string;
  children: ReactNode;
}

export function BaseEmail({ preview, children }: BaseEmailProps) {
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Img
              src={LOGO_URL}
              width={36}
              height={36}
              alt="mangui logo"
              style={styles.logoImg}
            />
            <span style={styles.wordmark}>
              man<span style={styles.wordmarkAccent}>gui</span>
            </span>
          </Section>

          {/* Content */}
          <Section style={styles.content}>{children}</Section>

          {/* Footer */}
          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={{ margin: "0 0 4px", ...styles.footer }}>
              <strong>mangui</strong> · Hecho en Argentina 🥭
            </Text>
            <Text style={{ margin: "0", ...styles.footer }}>
              ¿Preguntas? Escribinos a{" "}
              <Link href="mailto:hola@mangui.com.ar" style={styles.footerLink}>
                hola@mangui.com.ar
              </Link>
              {" · "}
              <Link href={APP_URL} style={styles.footerLink}>
                mangui.com.ar
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
