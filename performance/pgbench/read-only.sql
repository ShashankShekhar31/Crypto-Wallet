SELECT id
FROM exchange_accounts
WHERE id = (
  SELECT id
  FROM exchange_accounts
  LIMIT 1
);