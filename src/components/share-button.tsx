"use client";

import * as React from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface Props {
  id: string;
}

export function ShareButton({ id }: Props): React.JSX.Element {
  const [copying, setCopying] = React.useState(false);
  const onClick = async (): Promise<void> => {
    setCopying(true);
    try {
      const url = `${window.location.origin}/b/${id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", {
        description: `${url} — read-only on this device only`,
      });
    } catch (err) {
      toast.error("Copy failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCopying(false);
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={copying}>
      <Share2 />
      Share
    </Button>
  );
}
