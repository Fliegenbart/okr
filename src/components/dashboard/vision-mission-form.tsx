"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { upsertVisionMission } from "@/actions/vision-mission";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type VisionMissionFormProps = {
  initialVision?: string | null;
  initialMission?: string | null;
  initialAvatarImage?: string | null;
  coupleName?: string;
};

function getInitials(name?: string) {
  if (!name) return "OK";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function VisionMissionForm({
  initialVision,
  initialMission,
  initialAvatarImage,
  coupleName,
}: VisionMissionFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [vision, setVision] = useState(initialVision ?? "");
  const [mission, setMission] = useState(initialMission ?? "");
  const [avatarImage, setAvatarImage] = useState(initialAvatarImage ?? "");

  const saveAction = useAction(upsertVisionMission, {
    onSuccess: () => {
      toast.success("Vision, Mission und Foto gespeichert");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Konnte nicht speichern", {
        description: error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const validationErrors = saveAction.result.validationErrors as
    | {
        fieldErrors?: { vision?: string[]; mission?: string[] };
      }
    | undefined;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wählt ein Bild aus.");
      return;
    }

    if (file.size > 900_000) {
      toast.error("Das Bild ist noch zu groß. Bitte wählt eine kleinere Datei.");
      return;
    }

    let nextImage = "";

    try {
      nextImage = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Das Bild konnte nicht geladen werden."
      );
      return;
    }

    if (!nextImage) {
      toast.error("Das Bild konnte nicht geladen werden.");
      return;
    }

    setAvatarImage(nextImage);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveAction.execute({ vision, mission, avatarImage: avatarImage || null });
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-3 rounded-[1.6rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <Label>Paarfoto</Label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition hover:border-primary hover:shadow-sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Paarfoto auswählen"
            title="Klickt hier, um euer Foto hochzuladen"
          >
            {avatarImage ? (
              <Image
                src={avatarImage}
                alt="Paarfoto"
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-semibold text-primary">
                {getInitials(coupleName)}
              </div>
            )}
            <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 text-[10px] font-medium text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              Foto ändern
            </div>
          </button>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => fileInputRef.current?.click()}
              >
                Foto auswählen
              </Button>
              {avatarImage ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setAvatarImage("")}
                >
                  Foto entfernen
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Klickt auf den Avatar oder nutzt den Button. Ein kleines, quadratisches Bild
              funktioniert am besten.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-[1.6rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <Label htmlFor="vision-text">Was ist euch wichtig?</Label>
        <Textarea
          id="vision-text"
          value={vision}
          onChange={(event) => setVision(event.target.value)}
          placeholder="1-3 Sätze: Wofür wollt ihr als Paar stehen?"
          rows={4}
        />
        {validationErrors?.fieldErrors?.vision?.[0] ? (
          <p className="text-sm text-primary">{validationErrors.fieldErrors.vision[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-[1.6rem] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
        <Label htmlFor="mission-text">Wie wollt ihr das leben?</Label>
        <Textarea
          id="mission-text"
          value={mission}
          onChange={(event) => setMission(event.target.value)}
          placeholder="1-3 Sätze: Was tut ihr im Alltag dafür?"
          rows={4}
        />
        {validationErrors?.fieldErrors?.mission?.[0] ? (
          <p className="text-sm text-primary">{validationErrors.fieldErrors.mission[0]}</p>
        ) : null}
      </div>

      {saveAction.result.serverError ? (
        <p className="text-sm text-primary">{saveAction.result.serverError}</p>
      ) : null}

      <Button type="submit" className="rounded-2xl" disabled={saveAction.isPending}>
        Speichern
      </Button>
    </form>
  );
}
