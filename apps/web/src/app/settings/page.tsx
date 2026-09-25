import { Suspense } from "react";
import PageLoading from "@/app/loading";
import { SettingsView } from "./SettingsView";

export const metadata = { title: "Settings · Patched" };

export default function SettingsPage() {
  // The open tab lives in the URL (?tab=brand), which needs a Suspense boundary.
  return (
    <Suspense fallback={<PageLoading />}>
      <SettingsView />
    </Suspense>
  );
}
