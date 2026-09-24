import { Skeleton } from "@/components/ui/Skeleton";

/** Shown instantly on navigation while a server page loads its data. */
export default function Loading() {
  return (
    <main className="wrap py-8 grid gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[380px]" />
        ))}
      </div>
    </main>
  );
}
