-- Adds news_query column to accounts so each watchlist entry can drive a Google News RSS feed.
ALTER TABLE accounts ADD COLUMN news_query TEXT;

-- Populate disambiguated queries for all 15 accounts.
-- Quotes prevent false positives for short/common names (Current, Dave, Stripe).
UPDATE accounts SET news_query = '"Chime" neobank OR "Chime" fintech'                                     WHERE name = 'Chime';
UPDATE accounts SET news_query = '"SoFi" bank OR "SoFi Technologies" OR "SoFi" fintech'                   WHERE name = 'SoFi';
UPDATE accounts SET news_query = '"Cash App" fintech OR "Cash App" payments OR "Cash App" banking'        WHERE name = 'Cash App';
UPDATE accounts SET news_query = '"Dave Inc" fintech OR "Dave" neobank "cash advance"'                    WHERE name = 'Dave';
UPDATE accounts SET news_query = '"Varo Bank" OR "Varo Money" OR "Varo" neobank'                          WHERE name = 'Varo';
UPDATE accounts SET news_query = '"Current" neobank OR "Current" fintech banking "Stuart Sopp"'           WHERE name = 'Current';
UPDATE accounts SET news_query = '"Remitly" remittance OR "Remitly" fintech'                              WHERE name = 'Remitly';
UPDATE accounts SET news_query = '"Galileo Financial" fintech OR "Galileo" payments processing'           WHERE name = 'Galileo';
UPDATE accounts SET news_query = '"Pathward" bank fintech OR "Pathward Financial"'                        WHERE name = 'Pathward';
UPDATE accounts SET news_query = '"TelevisaUnivision" media OR "Televisa Univision" Spanish'              WHERE name = 'TelevisaUnivision';
UPDATE accounts SET news_query = 'CFPB "Consumer Financial Protection Bureau" fintech'                    WHERE name = 'CFPB';
UPDATE accounts SET news_query = 'OCC "Office of the Comptroller of the Currency" fintech bank charter'   WHERE name = 'OCC';
UPDATE accounts SET news_query = 'NYDFS "New York Department of Financial Services" fintech'              WHERE name = 'NYDFS';
UPDATE accounts SET news_query = '"California DFPI" fintech OR "CA DFPI" financial'                      WHERE name = 'California DFPI';
UPDATE accounts SET news_query = '"Stripe" fintech payments OR "Stripe Treasury" OR "Stripe Issuing"'    WHERE name = 'Stripe';
