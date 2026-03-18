import Link from "next/link";

import { conversationTemplates } from "@/lib/couple-engagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
        >
          Zurück zum Dashboard
        </Link>

        <div className="mt-6 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            Gesprächsvorlagen
          </h1>
          <p className="text-sm text-muted-foreground">
            Schnelle Startpunkte für wiederkehrende Gespräche und schwierige
            Situationen.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {conversationTemplates.map((template) => (
            <Card key={template.key} className="rounded-2xl border-border shadow-sm">
              <CardHeader>
                <CardTitle>{template.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Fokus
                  </p>
                  <p className="text-sm text-foreground">{template.focus}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Leitfragen
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {template.questions.map((question) => (
                      <li key={question}>- {question}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Follow-ups
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {template.followUps.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <Link
                  href={`/dashboard/check-in?template=${template.key}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                >
                  Im Check-in nutzen
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

