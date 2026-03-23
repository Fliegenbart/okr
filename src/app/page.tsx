import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-10 shadow-sm">
        <Image
          src="/logo.png"
          alt="OKR für Paare"
          width={220}
          height={60}
          className="mb-6 h-auto w-44"
          priority
        />
        <p className="text-sm uppercase tracking-[0.2em] text-primary">OKR für Paare</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
          Was ihr euch gemeinsam vornehmt, bleibt im Alltag sichtbar.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Meldet euch an, haltet eure wichtigsten Objectives und Key Results fest und bleibt Woche für Woche dran.
        </p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-secondary px-6 py-3 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-secondary"
        >
          Jetzt anmelden
        </Link>
      </div>
    </div>
  );
}
