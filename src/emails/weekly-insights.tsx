import { Button, Heading, Section, Text } from "@react-email/components"
import { BaseEmail } from "./_layout"

export interface WeeklyInsightItem {
  emoji: string
  title: string
  body: string
}

interface WeeklyInsightsEmailProps {
  insights: WeeklyInsightItem[]
  appUrl?: string
}

const styles = {
  heading: { color: "#1a1a1a", fontSize: "22px", fontWeight: "700", margin: "0 0 6px" },
  intro: { color: "#374151", fontSize: "15px", lineHeight: "1.6", margin: "0 0 20px" },
  card: { backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 16px", margin: "0 0 12px" },
  cardTitle: { color: "#1a1a1a", fontSize: "15px", fontWeight: "700", margin: "0 0 4px" },
  cardBody: { color: "#374151", fontSize: "14px", lineHeight: "1.5", margin: "0" },
  buttonContainer: { margin: "24px 0 8px", textAlign: "center" as const },
  button: { backgroundColor: "#F97316", borderRadius: "8px", color: "#ffffff", display: "inline-block", fontSize: "15px", fontWeight: "700", padding: "12px 28px", textDecoration: "none" },
}

export function WeeklyInsightsEmail({ insights, appUrl = "https://www.mangui.com.ar/inicio" }: WeeklyInsightsEmailProps) {
  return (
    <BaseEmail preview="Tu resumen semanal de Mangui 🥭">
      <Heading style={styles.heading}>Tu resumen semanal 🥭</Heading>
      <Text style={styles.intro}>Esto es lo que vimos en tus finanzas esta semana:</Text>
      {insights.map((i, idx) => (
        <Section key={idx} style={styles.card}>
          <Text style={styles.cardTitle}>{i.emoji} {i.title}</Text>
          <Text style={styles.cardBody}>{i.body}</Text>
        </Section>
      ))}
      <div style={styles.buttonContainer}>
        <Button href={appUrl} style={styles.button}>Abrir Mangui</Button>
      </div>
    </BaseEmail>
  )
}
