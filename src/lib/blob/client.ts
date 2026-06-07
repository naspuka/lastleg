import { put } from "@vercel/blob";

// Server-side wrapper around Vercel Blob. Env-gated: when
// BLOB_READ_WRITE_TOKEN is missing we throw a typed error rather than crash
// deep in the SDK, so call sites can render a sensible "blob not configured"
// state.
//
// We use server-side `put()` (not client-side direct upload) for Phase 2
// because the seller's file is small enough (5 MB max per CONVENTIONS) that
// a single server hop is fine. We can switch to signed-URL client uploads
// later if PDF size grows.

export class BlobNotConfiguredError extends Error {
  constructor() {
    super("BLOB_READ_WRITE_TOKEN is not set");
    this.name = "BlobNotConfiguredError";
  }
}

type UploadInput = {
  pathname: string; // e.g. `listings/<listingId>/ticket.pdf`
  body: Blob | ArrayBuffer | ReadableStream;
  contentType: string;
};

export async function uploadTicketPdf({
  pathname,
  body,
  contentType,
}: UploadInput) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new BlobNotConfiguredError();
  }

  const result = await put(pathname, body, {
    access: "public",
    // Tickets are sensitive — but Vercel Blob's `public` is really
    // "obscure URL only", not enumerable. We serve via short-TTL signed
    // URLs from the app server (P4 release-ticket); raw blob URL is never
    // shared with buyers.
    contentType,
    // randomSuffix avoids collisions when a seller re-uploads after
    // editing or when two listings briefly share a pathname.
    addRandomSuffix: true,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    contentType: result.contentType,
  };
}
