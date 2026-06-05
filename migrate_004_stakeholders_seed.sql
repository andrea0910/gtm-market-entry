-- Seed stakeholders for Nubank US expansion monitoring.
-- account_id links to the accounts table; NULL = person works at Nubank itself
-- (Nubank is not a monitored account — it is the company).

INSERT INTO stakeholders (company_id, account_id, name, role, type, public_positions) VALUES

-- ── Nubank executives ─────────────────────────────────────────────────────────
(1, NULL,
  'David Vélez',
  'CEO & Co-founder, Nubank',
  'exec',
  'Led Nubank to 100M+ customers across Brazil, Mexico, and Colombia. Named US expansion as a strategic priority in 2024 investor communications; publicly targeting underbanked Latino immigrants as the initial wedge demographic.'),

(1, NULL,
  'Cristina Junqueira',
  'Co-founder & President, Nubank',
  'exec',
  'Leads product and brand strategy. Has described the US as "the most important financial market we have not yet entered." Oversees the US GTM workstream directly.'),

(1, NULL,
  'Youssef Lahrech',
  'President, Nubank',
  'exec',
  'Former Head of Growth and VP Product. Named President in 2023; now responsible for Nubank''s international expansion execution including the US roadmap.'),

-- ── Competitor executives ─────────────────────────────────────────────────────
(1, 1,
  'Chris Britt',
  'CEO & Co-founder, Chime',
  'exec',
  'Building toward IPO. Cited the Latino demographic as an under-served growth segment in 2023 filings. Expanding into secured credit and savings to deepen ARPU before going public.'),

(1, 2,
  'Anthony Noto',
  'CEO, SoFi Technologies',
  'exec',
  'Completed national bank charter acquisition in 2022 — the structural playbook Nubank would follow. Targeting mass-affluent with high-yield savings and lending. Vocal about displacing incumbent banks.'),

(1, 3,
  'Jack Dorsey',
  'CEO, Block Inc',
  'exec',
  'Oversees Cash App (56M+ monthly actives). Prioritizing Bitcoin integration and Latin America expansion — directly intersecting with Nubank''s user base and product roadmap.'),

(1, 5,
  'Colin Walsh',
  'CEO & Co-founder, Varo',
  'exec',
  'Built the only neobank to hold a direct OCC national bank charter. Has publicly cited $300M+ and three years to obtain it — the most detailed public benchmark for Nubank''s US charter timeline.'),

(1, 6,
  'Stuart Sopp',
  'CEO & Co-founder, Current',
  'exec',
  'Focused on Gen Z and lower-income demographics; recent hiring signals a push into credit underwriting — encroaching on Nubank''s positioning.'),

(1, 15,
  'Patrick Collison',
  'CEO, Stripe',
  'partner',
  'Stripe Treasury and Issuing are the fastest path to a US banking product without a charter. Known for custom partnership pricing at scale. A Stripe deal could accelerate Nubank US launch by 12+ months vs. direct BaaS sourcing.'),

(1, 9,
  'Anthony Sharett',
  'CEO, Pathward Financial',
  'partner',
  'Pathward is a leading US sponsor bank for neobanks. Sharett has spoken publicly about the rigorous compliance diligence Pathward requires before onboarding new fintech partners.'),

-- ── Regulators ────────────────────────────────────────────────────────────────
(1, 12,
  'Michael Hsu',
  'Acting Comptroller of the Currency, OCC',
  'regulator',
  'Oversees national bank charter applications and fintech supervision. Has called for a "level playing field" between banks and fintech firms. The OCC is the primary federal gate for Nubank''s long-term charter strategy.'),

(1, 13,
  'Adrienne Harris',
  'Superintendent, NYDFS',
  'regulator',
  'Oversees BitLicense, money transmitter licensing, and consumer protection in New York — among the strictest state regulatory regimes in the US. Has stated openness to innovation within compliance guardrails.'),

(1, 14,
  'Clothilde Hewlett',
  'Commissioner, CA DFPI',
  'regulator',
  'Oversees money transmitter and consumer lending licenses in California, home to the largest US Hispanic population. Nubank''s California license is prerequisite to reaching its primary target demographic at scale.'),

(1, 11,
  'Rohit Chopra',
  'Former Director, CFPB',
  'regulator',
  'Championed open banking (Section 1033), UDAAP enforcement, and fair-lending rules that directly shape neobank product design. Monitoring his post-CFPB influence on consumer finance policy.'),

-- ── Analysts ─────────────────────────────────────────────────────────────────
(1, NULL,
  'Ron Shevlin',
  'Chief Research Officer, Cornerstone Advisors',
  'analyst',
  'Publishes the annual "What''s Going On In Banking" and "Fintech Frontiers" reports — the most-cited benchmarks for neobank customer acquisition, ARPU, and competitive share. Key voice on whether Nubank US is entering at the right time.'),

(1, NULL,
  'Jason Mikula',
  'Author, Fintech Business Weekly',
  'analyst',
  'Weekly newsletter with deep coverage of BaaS dynamics, charter strategy, and regulatory enforcement actions. Among the first to break sponsor bank failures and compliance crises that move the competitive landscape.'),

(1, NULL,
  'Simon Taylor',
  'Author, Fintech Brainfood',
  'analyst',
  'Covers embedded finance, cross-border fintech, and Latin America fintechs including Nubank. Strong signal for how institutional observers frame Nubank''s US entry narrative.'),

-- ── Press ─────────────────────────────────────────────────────────────────────
(1, NULL,
  'Julie VerHage-Greenberg',
  'Reporter, Bloomberg Fintech',
  'press',
  'Primary Bloomberg reporter on neobank funding rounds, IPO timelines, and regulatory actions. Coverage shapes institutional investor perception of the sector Nubank is entering.'),

(1, NULL,
  'Ryan Lawler',
  'Reporter, TechCrunch',
  'press',
  'Covers consumer fintech and challenger bank product launches. Breaking coverage of competitor funding and product announcements that signal market moves before they appear in signals data.');
