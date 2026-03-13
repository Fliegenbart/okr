"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
    >
      Logout
    </Button>
  );
}
