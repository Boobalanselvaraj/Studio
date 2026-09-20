-- Create secondary databases required by microservices/engines
CREATE DATABASE immich;
\c immich
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
