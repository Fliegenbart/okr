"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

type InviteJoinButtonProps = {
  token: string;
};

export function InviteJoinButton({ token }: InviteJoinButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleJoin = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    const result = await signIn("invite-login", {
      token,
      callbackUrl: "/dashboard",
      redirect: false,
    });

    setSubmitting(false);

    if (result?.error) {
      setErrorMessage("Der Link konnte gerade nicht verwendet werden.");
      return;
    }

    window.location.href = result?.url ?? "/dashboard";
  };

  return (
    <div className="flex flex-col justify-center gap-3 sm:flex-row">
      <Button
        type="button"
        onClick={handleJoin}
        className="rounded-2xl"
        disabled={submitting}
      >
        {submitting ? "Trete bei ..." : "Anmelden und beitreten"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-primary sm:basis-full sm:text-center">{errorMessage}</p>
      ) : null}
    </div>
  );
}
