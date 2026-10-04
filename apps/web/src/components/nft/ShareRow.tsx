"use client";

import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

/** Copy the page link, or open an X post draft about the patch. */
export function ShareRow({ text, path }: { text: string; path: string }) {
  const url = () => `${window.location.origin}${path}`;
  return (
    <div className="flex gap-2 flex-wrap">
      <Button size="small" onClick={() => navigator.clipboard.writeText(url()).then(() => toast("Link copied."), () => toast(url()))}>
        <Copy size={14} /> Copy link
      </Button>
      <Button size="small" onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url())}`, "_blank", "noopener")}>
        <Share2 size={14} /> Post on X
      </Button>
    </div>
  );
}
