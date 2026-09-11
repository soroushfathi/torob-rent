CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE workspaces (
 id uuid PRIMARY KEY, mode text NOT NULL CHECK(mode IN ('demo','real','test')), created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO workspaces(id,mode) VALUES('00000000-0000-4000-8000-000000000001','real');
CREATE TABLE users (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name text NOT NULL, email text, password_hash text, demo_role text CHECK(demo_role IN ('owner','renter')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,workspace_id), UNIQUE(email)
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(user_id,workspace_id) REFERENCES users(id,workspace_id)
);
CREATE TABLE listings (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL, title text NOT NULL, model text NOT NULL, category text NOT NULL DEFAULT 'laptop',
 chip text, ram integer CHECK(ram>=0), storage integer CHECK(storage>=0), description text NOT NULL DEFAULT '',
 condition text NOT NULL, accessories jsonb NOT NULL DEFAULT '[]', neighborhood text NOT NULL,
 daily_price bigint NOT NULL CHECK(daily_price BETWEEN 1000 AND 100000000), deposit bigint NOT NULL CHECK(deposit BETWEEN 0 AND 1000000000),
 min_days integer NOT NULL CHECK(min_days BETWEEN 1 AND 30), guarantee text NOT NULL DEFAULT '',
 available_from date NOT NULL, available_to date NOT NULL, blocked jsonb NOT NULL DEFAULT '[]', photos jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL CHECK(status IN ('draft','published','paused')), synthetic boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(available_from<available_to), UNIQUE(id,workspace_id), FOREIGN KEY(owner_id,workspace_id) REFERENCES users(id,workspace_id)
);
CREATE INDEX listings_workspace_status ON listings(workspace_id,status);
CREATE TABLE bookings (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 listing_id uuid NOT NULL, renter_id uuid NOT NULL, owner_id uuid NOT NULL,
 start_date date NOT NULL, end_date date NOT NULL, status text NOT NULL DEFAULT 'requested'
   CHECK(status IN ('requested','accepted','rejected','cancelled','expired','handed_over','completed')),
 request_key text NOT NULL, quote jsonb NOT NULL, terms jsonb NOT NULL, search_id uuid,
 rental_total bigint NOT NULL CHECK(rental_total>0), deposit bigint NOT NULL CHECK(deposit>=0),
 commission_estimate bigint NOT NULL CHECK(commission_estimate>=0), currency text NOT NULL DEFAULT 'IRT' CHECK(currency='IRT'),
 payment_mode text NOT NULL DEFAULT 'simulated' CHECK(payment_mode='simulated'),
 handoff jsonb, return_report jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, responded_at timestamptz, accepted_at timestamptz, completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(start_date<end_date AND end_date-start_date BETWEEN 1 AND 30), CHECK(owner_id<>renter_id),
 UNIQUE(workspace_id,renter_id,request_key), FOREIGN KEY(listing_id,workspace_id) REFERENCES listings(id,workspace_id),
 FOREIGN KEY(renter_id,workspace_id) REFERENCES users(id,workspace_id), FOREIGN KEY(owner_id,workspace_id) REFERENCES users(id,workspace_id),
 EXCLUDE USING gist (listing_id WITH =, daterange(start_date,end_date,'[)') WITH &&)
 WHERE (status IN ('accepted','handed_over','completed'))
);
CREATE INDEX bookings_workspace ON bookings(workspace_id,created_at);
CREATE INDEX bookings_expiry ON bookings(expires_at) WHERE status='requested';
CREATE TABLE events (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 user_id uuid, session_id text, event_key text NOT NULL, kind text NOT NULL
 CHECK(kind IN ('search','listing_view','comparison','booking_requested','booking_accepted','booking_rejected','booking_cancelled','booking_expired','booking_handed_over','booking_completed','owner_activated')),
 entity_id uuid, search_id uuid, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,event_key)
);
CREATE INDEX events_cohort ON events(workspace_id,search_id,kind);
CREATE INDEX events_kind_created ON events(kind,created_at);
CREATE TABLE media (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL, filename text NOT NULL UNIQUE, bytes integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,workspace_id) REFERENCES users(id,workspace_id)
);
CREATE TABLE ai_usage (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 capability text NOT NULL CHECK(capability IN ('search','listing')), provider text NOT NULL CHECK(provider IN ('model','fallback')),
 outcome text NOT NULL CHECK(outcome IN ('success','unconfigured','timeout','invalid','error','limited')),
 latency_ms integer NOT NULL, input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
 estimated_usd numeric, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL, count integer NOT NULL);
