-- Authenticated media must not resemble publicly cacheable static files.
UPDATE listings SET photos=(SELECT coalesce(jsonb_agg(CASE WHEN value LIKE '/api/media/%.webp' THEN regexp_replace(value,'\.webp$','') ELSE value END),'[]'::jsonb) FROM jsonb_array_elements_text(photos))
WHERE photos::text LIKE '%/api/media/%.webp%';
