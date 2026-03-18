"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createTimelineNote } from "@/actions/couple-engagement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TimelineNoteForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const action = useAction(createTimelineNote, {
    onSuccess: () => {
      toast.success("Timeline-Eintrag gespeichert");
      setTitle("");
      setSummary("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Timeline-Eintrag konnte nicht gespeichert werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    action.execute({ title, summary });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="timeline-title">Titel</Label>
        <Input
          id="timeline-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Was wollt ihr festhalten?"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timeline-summary">Notiz</Label>
        <Textarea
          id="timeline-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={4}
          placeholder="Wichtige Erkenntnis, Meilenstein oder Erinnerung"
        />
      </div>
      <Button type="submit" className="rounded-2xl" disabled={action.isPending}>
        Notiz speichern
      </Button>
    </form>
  );
}

