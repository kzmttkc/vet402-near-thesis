-- Upper bound on N. This is a method. It is not a recount of the known-relay
-- lower bound. Do not run it from the tests. It needs a GCP account.
--
-- N counts a transaction only when the opened body is one Delegate, the
-- delegate receiver is NEAR USDC, the only inner action is FunctionCall
-- ft_transfer, and that inner receipt succeeded. This query does not require
-- the inner receipt to succeed, so the count is at least N. The outer
-- receipt's receiver is the relayer, not USDC. USDC is delegate_action.receiver_id.
--
-- Filter on block_date so the scan stays on that partition. The dates are the
-- frozen census window widened to whole dates, 2026-10-08 through 2026-11-07,
-- a few hours outside the 11:42 UTC timestamps. A date the dataset does not
-- have returns no rows. An empty result is not a count of zero: the public
-- dataset can lag, and NEAR Lake on S3 stopped on 2026-03-24.
--
-- args is read as a STRING. If the column is already JSON, use args in place
-- of SAFE.PARSE_JSON(args). The two JSON paths cover an ActionView wrapper
-- and an unwrapped delegate_action object.
--
-- https://docs.near.org/data-infrastructure/big-query
-- https://github.com/near/near-public-lakehouse

WITH delegates AS (
  SELECT
    receipt_id,
    SAFE.PARSE_JSON(args) AS action
  FROM `bigquery-public-data.crypto_near_mainnet_us.receipt_actions`
  WHERE action_kind = 'DELEGATE_ACTION'
    AND block_date BETWEEN DATE '2026-10-08' AND DATE '2026-11-07'
)
SELECT COUNT(DISTINCT receipt_id) AS n_upper_bound
FROM delegates
WHERE COALESCE(
    JSON_VALUE(action, '$.Delegate.delegate_action.receiver_id'),
    JSON_VALUE(action, '$.delegate_action.receiver_id')
  ) = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1'
  AND COALESCE(
    ARRAY_LENGTH(JSON_QUERY_ARRAY(action, '$.Delegate.delegate_action.actions')),
    ARRAY_LENGTH(JSON_QUERY_ARRAY(action, '$.delegate_action.actions'))
  ) = 1
  AND COALESCE(
    JSON_VALUE(action, '$.Delegate.delegate_action.actions[0].FunctionCall.method_name'),
    JSON_VALUE(action, '$.delegate_action.actions[0].FunctionCall.method_name')
  ) = 'ft_transfer';
