import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap pt-16 pb-24 grid gap-4 justify-items-center text-center">
      <span className="eyebrow">404</span>
      <h1 className="text-4xl font-extrabold tracking-tight">Nothing is patched here</h1>
      <p className="text-[var(--muted)] max-w-md">This page or listing doesn&apos;t exist, or the link has a typo.</p>
      <div className="flex gap-2 flex-wrap justify-center">
        <Link href="/explore" className="btn-base btn-primary">Explore live listings</Link>
        <Link href="/" className="btn-base">Home</Link>
      </div>
    </main>
  );
}
