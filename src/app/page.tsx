import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-10 shadow-sm">
        <Image
          src="/logo.png"
          alt="OKR fuer Paare"
          width={220}
          height={60}
          className="mb-6 h-auto w-44"
          priority
        />
        <p className="text-sm uppercase tracking-[0.2em] text-primary">
          OKR fuer Paare
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground">
          Gemeinsame Ziele, gemeinsam wachsen.
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Starte dein gemeinsames OKR und halte eure Fortschritte fest.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-secondary px-6 py-3 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary hover:text-secondary"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
