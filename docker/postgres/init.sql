-- Runs once, on the first start of an empty volume.
-- Second database for integration tests (real PostgreSQL, never mocked).
CREATE DATABASE lumni_test OWNER lumni;
