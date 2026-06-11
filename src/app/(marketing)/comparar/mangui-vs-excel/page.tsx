import type { Metadata } from "next"
import { getComparison } from "@/lib/marketing/comparisons"
import { ComparisonView } from "@/components/marketing/comparison-view"

const data = getComparison("mangui-vs-excel")!

export const metadata: Metadata = {
  title: data.title,
  description: data.description,
}

export default function ManguiVsExcelPage() {
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
      <ComparisonView data={data} />
    </main>
  )
}
