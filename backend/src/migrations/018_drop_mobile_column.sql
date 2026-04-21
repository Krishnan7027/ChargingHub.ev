-- Migration 018: Drop mobile column (SMS OTP removed, email OTP only)
ALTER TABLE users DROP COLUMN IF EXISTS mobile;
