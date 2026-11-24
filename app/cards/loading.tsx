import { Skeleton } from "@/components/ui/feedback";

// Shown at once on navigation while a card whose data was just changed reads it again.
export default function Loading() {
  return (
    <main className="w-full flex-1 px-4 pt-6 sm:px-6">
      <Skeleton rows={8} />
    </main>
  );
}
