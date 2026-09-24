import { Skeleton } from "@/components/ui/Skeleton";

/** Listing page skeleton: the figure on the left, the patch panel and activity on the right. */
export default function Loading() {
  return (
    <main className="wrap py-6 grid gap-6" aria-busy="true" aria-label="Loading listing">
      <Skeleton className="h-5 w-40" />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <Skeleton className="h-[560px]" />
        <div className="grid gap-4 content-start">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-[220px]" />
          <Skeleton className="h-[180px]" />
        </div>
      </div>
    </main>
  );
}
