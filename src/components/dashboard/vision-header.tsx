import Image from "next/image";

type VisionHeaderProps = {
  vision?: string | null;
  coupleName: string;
};

export function VisionHeader({ vision, coupleName }: VisionHeaderProps) {
  const displayVision = vision?.trim().length
    ? vision
    : "Unsere gemeinsame Vision";

  return (
    <header className="space-y-3">
      <Image
        src="/logo.png"
        alt="OKR fuer Paare"
        width={160}
        height={40}
        className="h-auto w-32"
      />
      <p className="text-sm font-medium text-primary">
        {coupleName}
      </p>
      <blockquote className="text-2xl italic leading-snug text-foreground md:text-3xl">
        &ldquo;{displayVision}&rdquo;
      </blockquote>
    </header>
  );
}
