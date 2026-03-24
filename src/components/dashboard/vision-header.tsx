import Link from "next/link";
import Image from "next/image";

type VisionHeaderProps = {
  vision?: string | null;
  coupleName: string;
  avatarImage?: string | null;
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function VisionHeader({ vision, coupleName, avatarImage }: VisionHeaderProps) {
  const displayVision = vision?.trim().length ? vision : "Was uns als Paar wichtig ist";

  return (
    <header className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/dashboard/vision-mission"
            className="group relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/70 shadow-[0_16px_40px_rgba(34,18,30,0.08)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_22px_50px_rgba(193,0,103,0.12)] sm:h-24 sm:w-24"
            aria-label="Paarfoto bearbeiten"
            title="Klickt hier, um euer Foto zu ändern"
          >
            {avatarImage ? (
              <Image
                src={avatarImage}
                alt={`${coupleName} Avatar`}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-semibold text-primary sm:text-xl">
                {getInitials(coupleName) || "OK"}
              </div>
            )}
            <div className="absolute inset-0 flex items-end justify-center bg-black/0 pb-2 text-[10px] font-medium text-white opacity-0 transition group-hover:bg-black/28 group-hover:opacity-100">
              Foto ändern
            </div>
          </Link>
          <div className="space-y-2">
            <p className="dashboard-kicker text-[11px] font-extrabold text-primary">
              Performance Hub
            </p>
            <Image
              src="/logo.png"
              alt="OKR für Paare"
              width={160}
              height={40}
              className="h-auto w-32 sm:w-36"
            />
            <p className="text-base font-semibold leading-6 text-foreground">{coupleName}</p>
            <p className="max-w-xl text-sm text-muted-foreground">
              Klickt auf euer Foto, um es zu ändern. Hier seht ihr euren aktuellen Fokus und
              wie euer Quartal gerade läuft.
            </p>
          </div>
        </div>
        <div className="metric-glass rounded-[1.75rem] px-5 py-4">
          <p className="dashboard-kicker text-[10px] font-extrabold text-muted-foreground">Status</p>
          <p className="mt-2 font-display text-2xl font-extrabold tracking-[-0.05em] text-foreground">
            In Bewegung
          </p>
        </div>
      </div>
      <blockquote className="max-w-4xl font-display text-3xl font-semibold leading-[1.12] tracking-[-0.05em] text-foreground sm:text-4xl md:text-5xl">
        &ldquo;{displayVision}&rdquo;
      </blockquote>
    </header>
  );
}
