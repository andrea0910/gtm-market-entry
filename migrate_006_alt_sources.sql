-- Adds two new columns so accounts can drive EDGAR and Federal Register ingestion.
-- sec_cik        → CIK for public companies; drives 8-K filing ingestion from EDGAR.
-- fed_register_agency → agency slug for regulators; drives Federal Register rule ingestion.

ALTER TABLE accounts ADD COLUMN sec_cik TEXT;
ALTER TABLE accounts ADD COLUMN fed_register_agency TEXT;

-- Public companies with SEC filings
-- CIKs verified against SEC EDGAR full-text search
UPDATE accounts SET sec_cik = '0001818874' WHERE name = 'SoFi';
UPDATE accounts SET sec_cik = '0001512673' WHERE name = 'Cash App';   -- Block Inc is the filer
UPDATE accounts SET sec_cik = '0001786248' WHERE name = 'Dave';
UPDATE accounts SET sec_cik = '0001782170' WHERE name = 'Remitly';

-- Regulators → Federal Register agency slugs
UPDATE accounts SET fed_register_agency = 'consumer-financial-protection-bureau' WHERE name = 'CFPB';
UPDATE accounts SET fed_register_agency = 'comptroller-of-the-currency'          WHERE name = 'OCC';
