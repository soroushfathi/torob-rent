-- Aggregate-only views are the entire reporting role's database surface.
-- No user IDs, booking IDs, emails, text prompts, reports, or descriptions are exposed.
CREATE VIEW analytics_event_daily AS
 SELECT date_trunc('day',e.created_at AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran' AS time,w.mode,e.kind,count(*)::bigint AS events
 FROM events e JOIN workspaces w ON w.id=e.workspace_id GROUP BY 1,2,3;
CREATE VIEW analytics_search_cohorts AS
 WITH cohorts AS (
 SELECT e.id,e.search_id,e.created_at,w.mode,
  (e.payload->>'resultCount')::integer=0 AS zero,
  EXISTS(SELECT 1 FROM events x WHERE x.workspace_id=e.workspace_id AND x.search_id=e.search_id AND x.kind='listing_view') AS viewed,
  EXISTS(SELECT 1 FROM events x WHERE x.workspace_id=e.workspace_id AND x.search_id=e.search_id AND x.kind='comparison') AS compared,
  EXISTS(SELECT 1 FROM bookings b WHERE b.workspace_id=e.workspace_id AND b.search_id=e.search_id) AS requested,
  EXISTS(SELECT 1 FROM bookings b WHERE b.workspace_id=e.workspace_id AND b.search_id=e.search_id AND b.accepted_at IS NOT NULL) AS accepted,
  EXISTS(SELECT 1 FROM bookings b WHERE b.workspace_id=e.workspace_id AND b.search_id=e.search_id AND b.status='completed') AS completed
 FROM events e JOIN workspaces w ON w.id=e.workspace_id WHERE e.kind='search'
 ) SELECT date_trunc('day',created_at AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran' AS time,mode,
 count(*)::bigint AS searches,count(*) FILTER(WHERE zero)::bigint AS zero_results,
 count(*) FILTER(WHERE viewed)::bigint AS viewed,count(*) FILTER(WHERE compared)::bigint AS compared,
 count(*) FILTER(WHERE requested)::bigint AS requested,count(*) FILTER(WHERE accepted)::bigint AS accepted,
 count(*) FILTER(WHERE completed)::bigint AS completed
 FROM cohorts GROUP BY 1,2;
CREATE VIEW analytics_booking_cohorts AS
 SELECT date_trunc('day',b.created_at AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran' AS time,w.mode,
 count(*)::bigint AS requested_count,coalesce(sum(b.rental_total),0)::bigint AS requested_value,
 count(*) FILTER(WHERE b.accepted_at IS NOT NULL)::bigint AS accepted_count,
 coalesce(sum(b.rental_total) FILTER(WHERE b.accepted_at IS NOT NULL),0)::bigint AS accepted_value,
 count(*) FILTER(WHERE b.status='completed')::bigint AS completed_count,
 coalesce(sum(b.rental_total) FILTER(WHERE b.status='completed'),0)::bigint AS completed_gmv,
 coalesce(sum(b.commission_estimate) FILTER(WHERE b.status='completed'),0)::bigint AS estimated_commission,
 count(*) FILTER(WHERE b.status='cancelled')::bigint AS cancelled_count,
 count(*) FILTER(WHERE b.status='rejected')::bigint AS rejected_count,
 count(*) FILTER(WHERE b.handoff IS NOT NULL)::bigint AS handed_over_count
 FROM bookings b JOIN workspaces w ON w.id=b.workspace_id GROUP BY 1,2;
CREATE VIEW analytics_completed_daily AS
 SELECT date_trunc('day',b.completed_at AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'Asia/Tehran' AS time,w.mode,
 count(*)::bigint AS rentals,coalesce(sum(b.rental_total),0)::bigint AS gmv,
 coalesce(sum(b.commission_estimate),0)::bigint AS estimated_commission
 FROM bookings b JOIN workspaces w ON w.id=b.workspace_id WHERE b.status='completed' GROUP BY 1,2;
CREATE VIEW analytics_owner_response AS
 SELECT w.mode,'7d'::text AS window,percentile_cont(.5) WITHIN GROUP(ORDER BY extract(epoch FROM b.responded_at-b.created_at))::double precision AS median_seconds,
 count(*)::bigint AS responses
 FROM bookings b JOIN workspaces w ON w.id=b.workspace_id WHERE b.responded_at>now()-interval '7 days' GROUP BY w.mode;
CREATE FUNCTION protect_booking_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN
 IF OLD.quote IS DISTINCT FROM NEW.quote OR OLD.terms IS DISTINCT FROM NEW.terms
 OR OLD.rental_total<>NEW.rental_total OR OLD.deposit<>NEW.deposit OR OLD.commission_estimate<>NEW.commission_estimate
 OR OLD.start_date<>NEW.start_date OR OLD.end_date<>NEW.end_date OR OLD.listing_id<>NEW.listing_id
 OR OLD.owner_id<>NEW.owner_id OR OLD.renter_id<>NEW.renter_id OR OLD.workspace_id<>NEW.workspace_id
 THEN RAISE EXCEPTION 'Booking snapshots and parties are immutable'; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER booking_snapshot_immutable BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION protect_booking_snapshot();
