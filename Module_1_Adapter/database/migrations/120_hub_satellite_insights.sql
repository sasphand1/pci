-- Combined satellite scores (Go-Out Score per city, weekly city rankings) live in the hub
-- under the satellite category, next to the raw readings they are computed from.
INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label) VALUES
 ('sat_insights.api','sat_insights','api',false,'satellite',3,'Satellite scores: Go-Out Score and weekly city rankings')
ON CONFLICT (id) DO NOTHING;
