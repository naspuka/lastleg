// Single source of truth for the 5 launch corridors per D004.
// Route #5 is provisional (London <-> Bristol or Liverpool, TBD); slug stays
// stable so we can swap the label without breaking stored waitlist preferences.

type Route = {
  slug: string;
  label: string;
  provisional?: boolean;
};

export const ROUTES: readonly Route[] = [
  { slug: "lon-man", label: "London ↔ Manchester" },
  { slug: "lon-bir", label: "London ↔ Birmingham" },
  { slug: "lon-lee", label: "London ↔ Leeds" },
  { slug: "lon-edi", label: "London ↔ Edinburgh" },
  { slug: "lon-bri", label: "London ↔ Bristol", provisional: true },
];

export type RouteSlug = string;

export const ROUTE_SLUGS = ROUTES.map((r) => r.slug);
