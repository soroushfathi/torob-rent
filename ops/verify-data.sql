SELECT kind,count(*) AS total,count(search_id) AS attributed FROM events GROUP BY kind ORDER BY kind;
SELECT status,count(*) AS bookings,count(search_id) AS attributed,sum(rental_total) AS simulated_rental_toman,sum(deposit) AS separate_deposit_toman FROM bookings GROUP BY status;
SELECT mode,sum(searches) searches,sum(viewed) viewed,sum(compared) compared,sum(requested) requested,sum(accepted) accepted,sum(completed) completed FROM analytics_search_cohorts GROUP BY mode;
SELECT has_table_privilege('torob_reporting','users','SELECT') AS reporting_can_read_users,
has_table_privilege('torob_reporting','bookings','SELECT') AS reporting_can_read_bookings,
has_table_privilege('torob_reporting','analytics_completed_daily','SELECT') AS reporting_can_read_aggregates;
SELECT rolname,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname IN ('torob_app','torob_reporting');
