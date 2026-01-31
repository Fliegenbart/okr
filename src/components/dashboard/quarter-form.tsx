"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createQuarter } from "@/actions/quarter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type QuarterFormProps = {
  existingTitles: string[];
};

export function QuarterForm({ existingTitles }: QuarterFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const createAction = useAction(createQuarter, {
    onSuccess: () => {
      toast.success("Quartal erstellt");
      setTitle("");
      setStartsAt("");
      setEndsAt("");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Quartal konnte nicht erstellt werden", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createAction.execute({
      title,
      startsAt,
      endsAt,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="quarter-title">Titel (optional)</Label>
        <Input
          id="quarter-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={existingTitles[0] ? `z.B. ${existingTitles[0]}` : "Q1 2026"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quarter-start">Startdatum</Label>
          <Input
            id="quarter-start"
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quarter-end">Enddatum</Label>
          <Input
            id="quarter-end"
            type="date"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </div>
      </div>
      <Button type="submit" className="rounded-2xl" disabled={createAction.isPending}>
        Quartal anlegen
      </Button>
    </form>
  );
}
