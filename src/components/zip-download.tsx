"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  payload: { bundle: unknown; manifest: unknown; blueprint: unknown };
}

export function ZipDownload({ id, payload }: Props): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);

  const onClick = async (): Promise<void> => {
    setBusy(true);
    try {
      const res = await fetch(`/api/bundle/${id}/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        toast.error("ZIP failed", { description: text.slice(0, 200) });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aib-bundle-${id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Bundle ready", {
        description: `aib-bundle-${id}.zip`,
      });
    } catch (err) {
      toast.error("ZIP error", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      ZIP
    </Button>
  );
}
