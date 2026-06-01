"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  explanation: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Generic hover/click tooltip carrying an explanation string.
 *
 * V1: used as a generic wrapper. Bundle-view's auto-wiring of HTML-comment
 * anchors (e.g. `<!-- explain:slug -->`) inside artifact markdown is a
 * TODO — the stack generator anchors aren't emitted yet. Component itself
 * works as a standalone primitive for places where an explanation is
 * available client-side.
 */
export function ExplainTooltip({
  explanation,
  children,
  side = "top",
}: Props): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex cursor-help">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs whitespace-normal">
          {explanation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
