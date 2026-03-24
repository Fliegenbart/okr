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
    <header className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted sm:h-20 sm:w-20">
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
        </div>
        <div className="space-y-2">
          <Image
            src="/logo.png"
            alt="OKR für Paare"
            width={160}
            height={40}
            className="h-auto w-28 sm:w-32"
          />
          <p className="text-sm font-medium leading-6 text-primary">{coupleName}</p>
        </div>
      </div>
      <blockquote className="text-xl italic leading-snug text-foreground sm:text-2xl md:text-3xl">
        &ldquo;{displayVision}&rdquo;
      </blockquote>
    </header>
  );
}
