REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE torob_rent TO torob_app,torob_reporting;
GRANT USAGE ON SCHEMA public TO torob_app,torob_reporting;
GRANT SELECT,INSERT,UPDATE,DELETE ON workspaces,users,sessions,listings,bookings,events,media,ai_usage,rate_limits TO torob_app;
GRANT SELECT ON analytics_event_daily,analytics_search_cohorts,analytics_booking_cohorts,analytics_completed_daily,analytics_owner_response TO torob_reporting;
ALTER ROLE torob_reporting SET default_transaction_read_only=on;
ALTER ROLE torob_reporting SET statement_timeout='8s';
ALTER ROLE torob_reporting CONNECTION LIMIT 4;
ALTER ROLE torob_app CONNECTION LIMIT 20;
