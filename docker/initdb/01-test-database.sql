-- Runs once, when the Postgres volume is first created. The test suite needs
-- its own database, because it truncates tables between cases.
CREATE DATABASE declutter_test OWNER declutter;
