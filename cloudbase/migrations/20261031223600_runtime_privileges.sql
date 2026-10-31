-- The runtime key can invoke fixed business functions, not read/write business tables.
-- CloudBase system auth/storage schemas are intentionally outside this boundary.
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM service_role;
