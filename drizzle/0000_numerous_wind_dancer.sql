CREATE TYPE "public"."waitlist_role" AS ENUM('buyer', 'seller', 'both');--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" "waitlist_role" NOT NULL,
	"routes" text[] NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmation_sent_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "waitlist_created_at_idx" ON "waitlist" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "waitlist_invited_at_idx" ON "waitlist" USING btree ("invited_at");