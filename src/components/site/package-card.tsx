import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CheckList } from "./check-list";

type PackageCardProps = {
  name: string;
  summary: string;
  /** What's included, in order. */
  included: readonly string[];
  /** The price line at the bottom: "From ₹…", or how to ask for a price. Text only, never a button. */
  price: ReactNode;
};

/**
 * One package (Basic, Standard or Comprehensive) on /packages: its name, a
 * one-line summary, its checklist and its price line. The page localizes the
 * text and builds the price line. The heading is an h3, under the section's
 * h2 ("For cars").
 */
export function PackageCard({ name, summary, included, price }: PackageCardProps) {
  return (
    // --card-spacing: 24px of padding, like the service tiles.
    <Card className="h-full [--card-spacing:--spacing(6)]">
      <CardHeader className="gap-2">
        <CardTitle>
          <h3>{name}</h3>
        </CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <CheckList items={included} />
        {/* mt-auto: the price lines of the three cards sit on one line. */}
        <div className="mt-auto border-t border-border pt-4">{price}</div>
      </CardContent>
    </Card>
  );
}
