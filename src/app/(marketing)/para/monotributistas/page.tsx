import type { Metadata } from "next"
import { getAudience } from "@/lib/marketing/audiences"
import { AudienceView } from "@/components/marketing/audience-view"

const data = getAudience("monotributistas")!

export const metadata: Metadata = {
  title: data.title,
  description: data.description,
}

export default function MonotributistasPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  }

  return (
    <main className="flex-1 container mx-auto px-5 max-w-3xl py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <AudienceView data={data} />
    </main>
  )
}
