import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { OPERATOR_LABEL } from "@/lib/operators";
import { formatGBP } from "@/lib/pricing";
import { formatUkDateTime, humaniseUntil } from "@/lib/time";

type Listing = {
  id: string;
  operator: keyof typeof OPERATOR_LABEL;
  routeOrigin: string;
  routeDestination: string;
  departureAt: Date;
  currentPricePence: number;
  originalPricePence: number;
  hasPassengerName: boolean;
};

export function ListingCard({ listing }: { listing: Listing }) {
  const discount = Math.round(
    100 - (100 * listing.currentPricePence) / listing.originalPricePence
  );
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group hover:border-primary/40 hover:shadow-primary/5 block rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {OPERATOR_LABEL[listing.operator]}
          </div>
          <div className="font-heading mt-2 text-lg font-semibold tracking-tight leading-tight">
            {listing.routeOrigin}
            <span className="text-muted-foreground mx-1.5">→</span>
            {listing.routeDestination}
          </div>
          <div className="text-muted-foreground mt-1 text-xs">
            {formatUkDateTime(listing.departureAt)} ·{" "}
            <span className="text-primary font-medium">
              {humaniseUntil(listing.departureAt)} away
            </span>
          </div>
          {listing.hasPassengerName && (
            <Badge variant="outline" className="mt-3 text-[10px]">
              Named ticket
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-heading text-2xl font-bold text-primary">
            {formatGBP(listing.currentPricePence)}
          </div>
          <div className="text-muted-foreground text-xs">
            <span className="line-through">
              {formatGBP(listing.originalPricePence)}
            </span>
            {discount > 0 && (
              <Badge className="bg-brand-coral text-brand-coral-foreground hover:bg-brand-coral-hover border-brand-coral ml-2">
                −{discount}%
              </Badge>
            )}
          </div>
          <div className="text-primary mt-3 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View <ArrowRight className="inline size-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}
