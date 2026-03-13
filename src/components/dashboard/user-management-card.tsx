import { Card, CardContent } from "@/components/ui/card";

type UserManagementCardProps = {
  currentUserId: string;
  members: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
  pendingInvite: {
    email: string;
    expiresAt: string;
  } | null;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function UserManagementCard({
  currentUserId,
  members,
  pendingInvite,
}: UserManagementCardProps) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.2em] text-primary">
            Nutzerverwaltung
          </p>
          <p className="text-sm text-muted-foreground">
            Überblick über euer Couple und offene Einladungen.
          </p>
        </div>

        <div className="space-y-3">
          {members.map((member) => {
            const isCurrentUser = member.id === currentUserId;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {member.name?.trim() || "Noch ohne Namen"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.email ?? "Keine E-Mail hinterlegt"}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {isCurrentUser ? "Du" : "Mitglied"}
                </span>
              </div>
            );
          })}

          {pendingInvite ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground">
                Einladung ausstehend
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingInvite.email}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gültig bis{" "}
                {dateFormatter.format(new Date(pendingInvite.expiresAt))}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">
                Keine offene Einladung
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sobald ihr jemanden einladet, erscheint der Status hier.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
