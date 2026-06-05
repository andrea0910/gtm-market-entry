-- Migration 001: Add job board tracking columns to accounts
-- Existing DB:  wrangler d1 execute market-intel-db --file=migrate_001_job_board.sql
-- Local DB:     wrangler d1 execute market-intel-db --local --file=migrate_001_job_board.sql

ALTER TABLE accounts ADD COLUMN job_board_provider TEXT;
ALTER TABLE accounts ADD COLUMN job_board_slug TEXT;

-- Verified slugs (confirmed against live APIs 2026-06-03)
-- Dave and Remitly are NULL: not found on Greenhouse or Lever public boards
UPDATE accounts SET job_board_provider = 'greenhouse', job_board_slug = 'chime'    WHERE name = 'Chime';
UPDATE accounts SET job_board_provider = 'greenhouse', job_board_slug = 'sofi'     WHERE name = 'SoFi';
UPDATE accounts SET job_board_provider = 'greenhouse', job_board_slug = 'block'    WHERE name = 'Cash App';
UPDATE accounts SET job_board_provider = 'greenhouse', job_board_slug = 'current'  WHERE name = 'Current';
UPDATE accounts SET job_board_provider = 'lever',      job_board_slug = 'varomoney' WHERE name = 'Varo';
-- Remitly: not found on Greenhouse or Lever public boards
UPDATE accounts SET job_board_provider = 'greenhouse', job_board_slug = 'stripe'   WHERE name = 'Stripe';

-- Stripe: not in the initial seed; adding now as a tier-2 tracked account.
-- Treasury + Issuing create direct product-surface overlap with Nubank US.
INSERT INTO accounts (company_id, name, type, hq_country, website, description, tier, metadata, job_board_provider, job_board_slug)
VALUES (
  1,
  'Stripe',
  'partner',
  'US',
  'https://stripe.com',
  'Payments infrastructure; Stripe Treasury and Issuing create direct product-surface overlap with Nubank US. Hiring signals reveal product direction.',
  2,
  '{"focus":"payments infrastructure","products":["Treasury","Issuing","Financial Connections"]}',
  'greenhouse',
  'stripe'
);
