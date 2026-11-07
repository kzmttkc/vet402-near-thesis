-- Upper bound on N. This is the version that cuts the window by timestamp
-- and also prints one row per day. sql/n-upper-bound.sql stays the whole-date
-- count. The inner receipt is not required to succeed, so the count is at
-- least N. Do not run this file from the tests.
--
WITH d AS (
  SELECT receipt_id, block_date, block_timestamp_utc, SAFE.PARSE_JSON(args) AS action
  FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
  WHERE action_kind = 'DELEGATE_ACTION'
    AND block_date BETWEEN DATE '2026-10-08' AND DATE '2026-11-07'
), m AS (
  SELECT receipt_id, block_date, block_timestamp_utc FROM d
  WHERE COALESCE(JSON_VALUE(action, '$.Delegate.delegate_action.receiver_id'), JSON_VALUE(action, '$.delegate_action.receiver_id')) = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1'
    AND COALESCE(ARRAY_LENGTH(JSON_QUERY_ARRAY(action, '$.Delegate.delegate_action.actions')), ARRAY_LENGTH(JSON_QUERY_ARRAY(action, '$.delegate_action.actions'))) = 1
    AND COALESCE(JSON_VALUE(action, '$.Delegate.delegate_action.actions[0].FunctionCall.method_name'), JSON_VALUE(action, '$.delegate_action.actions[0].FunctionCall.method_name')) = 'ft_transfer'
), daily AS (
  SELECT block_date, COUNT(DISTINCT receipt_id) AS matched FROM m GROUP BY block_date
), alldays AS (
  SELECT block_date, COUNT(DISTINCT receipt_id) AS delegates, MAX(block_timestamp_utc) AS last_ts FROM d GROUP BY block_date
)
SELECT a.block_date, a.delegates, IFNULL(daily.matched, 0) AS matched, a.last_ts,
  (SELECT COUNT(DISTINCT receipt_id) FROM m WHERE block_timestamp_utc >= TIMESTAMP '2026-10-08 11:42:00+00' AND block_timestamp_utc < TIMESTAMP '2026-11-07 11:42:00+00') AS n_upper_bound_exact_window
FROM alldays a LEFT JOIN daily USING (block_date) ORDER BY a.block_date
