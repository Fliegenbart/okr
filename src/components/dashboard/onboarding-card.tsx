"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { createCouple } from "@/actions/couple";
import { acceptInvite } from "@/actions/invite";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Step = "choose" | "create" | "join";

type OnboardingCardProps = {
  userEmail?: string | null;
  initialInviteToken?: string | null;
};

export function OnboardingCard({
  userEmail,
  initialInviteToken,
}: OnboardingCardProps) {
  const router = useRouter();
  const normalizedInviteToken = initialInviteToken?.trim() ?? "";
  const [step, setStep] = useState<Step>(
    normalizedInviteToken ? "join" : "choose"
  );
  const [name, setName] = useState("");
  const [vision, setVision] = useState("");
  const [inviteToken, setInviteToken] = useState(normalizedInviteToken);

  const createAction = useAction(createCouple, {
    onSuccess: ({ data }) => {
      if (data?.inviteCode) {
        toast.success("Couple erstellt", {
          description: `Euer Einladungscode: ${data.inviteCode}`,
        });
      }
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Konnte Couple nicht erstellen", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const joinAction = useAction(acceptInvite, {
    onSuccess: () => {
      toast.success("Willkommen im Couple");
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Beitritt fehlgeschlagen", {
        description:
          error.serverError ?? error.validationErrors?.formErrors?.[0] ?? "",
      });
    },
  });

  const isPending = createAction.isPending || joinAction.isPending;

  const createErrors = useMemo(() => {
    return createAction.result.validationErrors as
      | {
          formErrors?: string[];
          fieldErrors?: { name?: string[]; vision?: string[] };
        }
      | undefined;
  }, [createAction.result.validationErrors]);

  const joinErrors = useMemo(() => {
    return joinAction.result.validationErrors as
      | {
        formErrors?: string[];
        fieldErrors?: { token?: string[] };
      }
      | undefined;
  }, [joinAction.result.validationErrors]);

  const handleStepChange = (nextStep: Step) => {
    setStep(nextStep);
    createAction.reset();
    joinAction.reset();
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createAction.execute({ name, vision });
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    joinAction.execute({ token: inviteToken });
  };

  return (
    <Card className="mx-auto w-full max-w-xl rounded-2xl border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl text-foreground">
          Willkommen bei OKR fuer Paare
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Erstellt euer Couple oder tretet mit einem Einladungslink bei.
        </CardDescription>
        {userEmail ? (
          <p className="text-sm text-muted-foreground">
            Angemeldet als {userEmail}
          </p>
        ) : null}
      </CardHeader>
      <Separator className="bg-border" />
      <CardContent className="pt-6">
        {step === "choose" ? (
          <div className="space-y-4">
            <Button
              className="w-full rounded-2xl"
              onClick={() => handleStepChange("create")}
            >
              Couple gruenden
            </Button>
            <Button
              className="w-full rounded-2xl"
              variant="outline"
              onClick={() => handleStepChange("join")}
            >
              Einladungslink eingeben
            </Button>
          </div>
        ) : null}

        {step === "create" ? (
          <form className="space-y-5" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="couple-name">Couple-Name</Label>
              <Input
                id="couple-name"
                name="name"
                placeholder="z.B. Mia & Leon"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {createErrors?.fieldErrors?.name?.[0] ? (
                <p className="text-sm text-primary">
                  {createErrors.fieldErrors.name[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="couple-vision">Vision (optional)</Label>
              <Input
                id="couple-vision"
                name="vision"
                placeholder="z.B. Wir wachsen gemeinsam"
                value={vision}
                onChange={(event) => setVision(event.target.value)}
              />
              {createErrors?.fieldErrors?.vision?.[0] ? (
                <p className="text-sm text-primary">
                  {createErrors.fieldErrors.vision[0]}
                </p>
              ) : null}
            </div>
            {createAction.result.serverError ? (
              <p className="text-sm text-primary">
                {createAction.result.serverError}
              </p>
            ) : null}
            {createErrors?.formErrors?.[0] ? (
              <p className="text-sm text-primary">
                {createErrors.formErrors[0]}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={isPending}
              >
                Couple erstellen
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={() => handleStepChange("choose")}
              >
                Zurueck
              </Button>
            </div>
          </form>
        ) : null}

        {step === "join" ? (
          <form className="space-y-5" onSubmit={handleJoin}>
            <div className="space-y-2">
              <Label htmlFor="invite-code">Einladungstoken</Label>
              <Input
                id="invite-code"
                name="token"
                placeholder="z.B. 8f2d... (aus dem Link)"
                value={inviteToken}
                onChange={(event) => setInviteToken(event.target.value)}
              />
              {joinErrors?.fieldErrors?.token?.[0] ? (
                <p className="text-sm text-primary">
                  {joinErrors.fieldErrors.token[0]}
                </p>
              ) : null}
            </div>
            {normalizedInviteToken ? (
              <p className="text-xs text-muted-foreground">
                Einladung aus dem Link uebernommen.
              </p>
            ) : null}
            {joinAction.result.serverError ? (
              <p className="text-sm text-primary">
                {joinAction.result.serverError}
              </p>
            ) : null}
            {joinErrors?.formErrors?.[0] ? (
              <p className="text-sm text-primary">
                {joinErrors.formErrors[0]}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                className="rounded-2xl"
                disabled={isPending}
              >
                Beitreten
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={() => handleStepChange("choose")}
              >
                Zurueck
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {isPending ? "Speichere..." : ""}
      </CardFooter>
    </Card>
  );
}
