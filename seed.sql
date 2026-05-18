-- Seed data: Nubank US expansion
-- Apply after schema.sql:
--   wrangler d1 execute market-intel-db --local --file=seed.sql

INSERT INTO companies (name, hq_country, target_market, product_surface, entry_thesis) VALUES (
  'Nubank',
  'BR',
  'US',
  '["digital banking","credit card","personal loans","savings","crypto"]',
  'Capture underbanked US consumers and the resident Latino immigrant population with a fee-free, mobile-first neobank. Leverage brand trust built across Brazil and Mexico to differentiate on cultural fit before expanding to mainstream US demographics.'
);

-- Tier-1 competitors: direct neobank rivals in the target demographic
INSERT INTO accounts (company_id, name, type, hq_country, website, description, tier, metadata) VALUES

(1, 'Chime', 'competitor', 'US', 'https://chime.com',
  'Largest US neobank by account count; fee-free checking, SpotMe overdraft, early direct deposit.',
  1, '{"est_customers":"22M","last_valuation_usd":"25B","revenue_model":"interchange"}'),

(1, 'SoFi', 'competitor', 'US', 'https://sofi.com',
  'Full-stack fintech with national bank charter; targets mass-affluent with high-APY savings and lending products.',
  1, '{"ticker":"SOFI","bank_charter":true,"est_customers":"8M"}'),

(1, 'Cash App', 'competitor', 'US', 'https://cash.app',
  'Block-owned P2P and banking app dominant in the 18-34 urban segment.',
  1, '{"parent":"Block Inc","ticker":"SQ","est_monthly_actives":"56M"}'),

-- Tier-2 competitors: adjacent or sub-scale but strategically relevant
(1, 'Dave', 'competitor', 'US', 'https://dave.com',
  'Cash-advance neobank for lower-income users; ExtraCash product overlaps Nubank credit positioning.',
  2, '{"ticker":"DAVE","focus":"cash advance"}'),

(1, 'Varo', 'competitor', 'US', 'https://varomoney.com',
  'US neobank; only fintech to hold a national bank charter directly. Direct structural comparison for Nubank''s US charter strategy.',
  2, '{"focus":"national bank charter","est_customers":"8M"}'),

(1, 'Current', 'competitor', 'US', 'https://current.com',
  'Gen-Z-focused neobank; early direct deposit, no overdraft fees.',
  2, '{"focus":"Gen Z","est_customers":"4M"}'),

(1, 'Remitly', 'competitor', 'US', 'https://remitly.com',
  'Cross-border remittance platform popular with Latino immigrants — directly overlapping target demographic.',
  2, '{"ticker":"RELY","focus":"immigrant remittance"}'),

-- Potential infrastructure partners (card issuing, sponsor bank)
(1, 'Galileo', 'partner', 'US', 'https://galileo-ft.com',
  'SoFi-owned card-issuing and account-processing platform; standard infrastructure for US neobanks.',
  1, '{"model":"card issuing + processing","parent":"SoFi"}'),

(1, 'Pathward', 'partner', 'US', 'https://pathward.com',
  'Sponsor bank for US neobanks — provides the banking charter Nubank would rent before pursuing its own.',
  1, '{"model":"sponsor bank","focus":"BaaS"}'),

-- Distribution partners targeting the Latino-immigrant wedge
(1, 'TelevisaUnivision', 'partner', 'US', 'https://televisaunivision.com',
  'Largest Spanish-language media company in the US; distribution and brand-trust channel for the Latino-immigrant wedge.',
  2, '{"model":"media distribution","reach":"Spanish-speaking US"}'),

-- Federal and state regulators whose rules directly gate the US product
(1, 'CFPB', 'regulator', 'US', 'https://cfpb.gov',
  'Consumer Financial Protection Bureau. Open banking, UDAAP, and fair-lending rules directly shape Nubank US product design.',
  1, '{"type":"federal","key_rule_areas":["open banking","UDAAP","fair lending"]}'),

(1, 'OCC', 'regulator', 'US', 'https://occ.treas.gov',
  'Office of the Comptroller of the Currency. Issues national bank charters; sets BSA/AML and CRA requirements.',
  1, '{"type":"federal","key_rule_areas":["fintech charter","BSA/AML","CRA"]}'),

(1, 'NYDFS', 'regulator', 'US', 'https://dfs.ny.gov',
  'New York Department of Financial Services. Gates NY market; required BitLicense for crypto operations.',
  1, '{"type":"state","jurisdiction":"NY","key_rule_areas":["BitLicense","money transmitter"]}'),

(1, 'California DFPI', 'regulator', 'US', 'https://dfpi.ca.gov',
  'California Department of Financial Protection and Innovation. Gates the largest US Hispanic population market.',
  1, '{"type":"state","jurisdiction":"CA","key_rule_areas":["money transmitter","consumer protection"]}');