CREATE TYPE "public"."guarantee_claim_reason" AS ENUM('denied_boarding_name_check', 'denied_boarding_already_scanned', 'operator_cancellation', 'ticket_invalid', 'seller_misconduct', 'other');--> statement-breakpoint
CREATE TYPE "public"."guarantee_claim_status" AS ENUM('pending', 'auto_approved', 'under_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_verification', 'live', 'sold', 'expired', 'withdrawn', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."listing_verification_status" AS ENUM('pending', 'pdf_parsed', 'receipt_matched', 'failed');--> statement-breakpoint
CREATE TYPE "public"."operator" AS ENUM('megabus', 'national_express', 'flixbus', 'stagecoach');--> statement-breakpoint
CREATE TYPE "public"."operator_ticket_status" AS ENUM('live', 'sold', 'expired');--> statement-breakpoint
CREATE TYPE "public"."transaction_dispute_status" AS ENUM('none', 'open', 'resolved_buyer', 'resolved_seller');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending_payment', 'paid', 'ticket_revealed', 'completed', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('buyer', 'seller', 'both');--> statement-breakpoint
CREATE TABLE "route_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"route_origin" text NOT NULL,
	"route_destination" text NOT NULL,
	"max_price_pence" integer,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_sms" boolean DEFAULT false NOT NULL,
	"notify_push" boolean DEFAULT false NOT NULL,
	"last_match_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_alerts_window_ordered" CHECK ("route_alerts"."window_end" > "route_alerts"."window_start"),
	CONSTRAINT "route_alerts_max_price_positive" CHECK ("route_alerts"."max_price_pence" IS NULL OR "route_alerts"."max_price_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"handle" text NOT NULL,
	"role" "user_role" DEFAULT 'buyer' NOT NULL,
	"stripe_connect_account_id" text,
	"stripe_identity_verified_at" timestamp with time zone,
	"guarantee_claims_used" integer DEFAULT 0 NOT NULL,
	"banned_at" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"operator" "operator" NOT NULL,
	"route_origin" text NOT NULL,
	"route_destination" text NOT NULL,
	"departure_at" timestamp with time zone NOT NULL,
	"original_price_pence" integer NOT NULL,
	"list_price_pence" integer NOT NULL,
	"floor_price_pence" integer NOT NULL,
	"current_price_pence" integer NOT NULL,
	"has_passenger_name" boolean DEFAULT false NOT NULL,
	"passenger_name_first" text,
	"ticket_pdf_blob_url" text,
	"booking_reference" text,
	"operator_pnr" text,
	"receipt_email_hash" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"verification_status" "listing_verification_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_list_le_original" CHECK ("listings"."list_price_pence" <= "listings"."original_price_pence"),
	CONSTRAINT "listings_floor_le_list" CHECK ("listings"."floor_price_pence" <= "listings"."list_price_pence"),
	CONSTRAINT "listings_prices_positive" CHECK ("listings"."original_price_pence" > 0 AND "listings"."list_price_pence" > 0 AND "listings"."floor_price_pence" >= 0 AND "listings"."current_price_pence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "operator_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator" "operator" NOT NULL,
	"booking_reference" text NOT NULL,
	"first_seen_listing_id" uuid NOT NULL,
	"sold_in_transaction_id" uuid,
	"status" "operator_ticket_status" DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guarantee_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"reason" "guarantee_claim_reason" NOT NULL,
	"status" "guarantee_claim_status" DEFAULT 'pending' NOT NULL,
	"evidence_text" text,
	"evidence_blob_url" text,
	"resolved_by_user_id" uuid,
	"refund_amount_pence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "guarantee_claims_refund_nonneg" CHECK ("guarantee_claims"."refund_amount_pence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"status" "transaction_status" DEFAULT 'pending_payment' NOT NULL,
	"dispute_status" "transaction_dispute_status" DEFAULT 'none' NOT NULL,
	"price_pence" integer NOT NULL,
	"buyer_fee_pence" integer NOT NULL,
	"seller_payout_pence" integer NOT NULL,
	"stripe_payment_intent" text,
	"escrow_release_at" timestamp with time zone NOT NULL,
	"ticket_revealed_at" timestamp with time zone,
	"ticket_released_at" timestamp with time zone,
	"scan_confirmed_at" timestamp with time zone,
	"payout_released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_money_nonneg" CHECK ("transactions"."price_pence" >= 0 AND "transactions"."buyer_fee_pence" >= 0 AND "transactions"."seller_payout_pence" >= 0)
);
--> statement-breakpoint
ALTER TABLE "route_alerts" ADD CONSTRAINT "route_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_tickets" ADD CONSTRAINT "operator_tickets_first_seen_listing_id_listings_id_fk" FOREIGN KEY ("first_seen_listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantee_claims" ADD CONSTRAINT "guarantee_claims_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_alerts_route_idx" ON "route_alerts" USING btree ("route_origin","route_destination","window_start","window_end");--> statement-breakpoint
CREATE INDEX "route_alerts_user_idx" ON "route_alerts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_active_idx" ON "users" USING btree ("email") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_active_idx" ON "users" USING btree ("handle") WHERE "users"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "listings_status_departure_idx" ON "listings" USING btree ("status","departure_at");--> statement-breakpoint
CREATE INDEX "listings_route_idx" ON "listings" USING btree ("route_origin","route_destination","departure_at");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "listings_op_booking_idx" ON "listings" USING btree ("operator","booking_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_tickets_op_booking_idx" ON "operator_tickets" USING btree ("operator","booking_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "guarantee_claims_transaction_idx" ON "guarantee_claims" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "guarantee_claims_status_idx" ON "guarantee_claims" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_listing_unique_idx" ON "transactions" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "transactions_buyer_idx" ON "transactions" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_seller_idx" ON "transactions" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_escrow_release_idx" ON "transactions" USING btree ("escrow_release_at");