-- Apply after the shared accounts, campaigns, passes, and wallet schema.
CREATE TABLE IF NOT EXISTS idempotency_records (
  actor_id uuid NOT NULL REFERENCES users(id),
  operation text NOT NULL,
  request_key uuid NOT NULL,
  request_fingerprint text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, request_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_records_scope_unique
  ON idempotency_records (actor_id, operation, request_key);

CREATE TABLE merchant_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchant_profiles(user_id),
  admin_id uuid NOT NULL REFERENCES users(id),
  amount_syp bigint NOT NULL CHECK (amount_syp BETWEEN 1 AND 9007199254740991),
  payment_method text NOT NULL CHECK (
    payment_method IN ('cash', 'sham_cash', 'syriatel_cash', 'bank_transfer')
  ),
  reference_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX merchant_topups_merchant_created_idx
  ON merchant_topups (merchant_id, created_at DESC, id DESC);

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_qr_pass_id uuid NOT NULL UNIQUE REFERENCES offer_qr_passes(id),
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  merchant_id uuid NOT NULL REFERENCES merchant_profiles(user_id),
  campaign_marketer_id uuid REFERENCES campaign_marketers(id),
  customer_id uuid NOT NULL REFERENCES customer_profiles(user_id),
  attribution_source text NOT NULL CHECK (
    attribution_source IN ('marketer', 'merchant_direct')
  ),
  quantity integer NOT NULL CHECK (quantity > 0),
  original_amount_syp bigint NOT NULL CHECK (
    original_amount_syp BETWEEN 0 AND 9007199254740991
  ),
  customer_paid_cash_syp bigint NOT NULL CHECK (
    customer_paid_cash_syp BETWEEN 0 AND 9007199254740991
  ),
  marketer_commission_syp bigint NOT NULL CHECK (
    marketer_commission_syp BETWEEN 0 AND 9007199254740991
  ),
  platform_total_fee_syp bigint NOT NULL CHECK (
    platform_total_fee_syp BETWEEN 0 AND 9007199254740991
  ),
  customer_cashback_syp bigint NOT NULL CHECK (
    customer_cashback_syp BETWEEN 0 AND 9007199254740991
  ),
  platform_net_fee_syp bigint NOT NULL CHECK (
    platform_net_fee_syp BETWEEN 0 AND 9007199254740991
  ),
  total_deducted_reserve_syp bigint NOT NULL CHECK (
    total_deducted_reserve_syp BETWEEN 0 AND 9007199254740991
  ),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_cashback_fee_check CHECK (
    platform_net_fee_syp + customer_cashback_syp = platform_total_fee_syp
  )
);

CREATE INDEX sales_campaign_scanned_idx
  ON sales (campaign_id, scanned_at DESC, id DESC);
CREATE INDEX sales_marketer_campaign_idx
  ON sales (campaign_marketer_id, campaign_id)
  WHERE campaign_marketer_id IS NOT NULL;
CREATE INDEX sales_customer_scanned_idx
  ON sales (customer_id, scanned_at DESC, id DESC);

CREATE TABLE money_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id),
  campaign_id uuid REFERENCES campaigns(id),
  sale_id uuid REFERENCES sales(id),
  topup_id uuid REFERENCES merchant_topups(id),
  payout_id uuid,
  voucher_id uuid,
  customer_id uuid REFERENCES customer_profiles(user_id),
  kind text NOT NULL CHECK (
    kind IN (
      'merchant_topup',
      'campaign_reserve_lock',
      'campaign_reserve_unlock',
      'sale_reserve_debit',
      'marketer_commission_credit',
      'customer_cashback_accrual',
      'customer_cashback_milestone_unlock',
      'platform_net_fee',
      'payout_hold',
      'payout_release_refund',
      'payout_completed',
      'payout_transfer_reversal',
      'cashback_voucher_reservation',
      'cashback_voucher_reservation_release',
      'cashback_voucher_merchant_credit'
    )
  ),
  amount_syp bigint NOT NULL CHECK (amount_syp BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT money_movement_origin_check CHECK (
    num_nonnulls(sale_id, topup_id, payout_id, voucher_id, campaign_id) = 1
    OR (
      sale_id IS NOT NULL
      AND campaign_id IS NOT NULL
      AND topup_id IS NULL
      AND payout_id IS NULL
      AND voucher_id IS NULL
    )
  )
);

CREATE INDEX money_movements_wallet_created_idx
  ON money_movements (wallet_id, created_at DESC, id DESC)
  WHERE wallet_id IS NOT NULL;
CREATE INDEX money_movements_customer_kind_idx
  ON money_movements (customer_id, kind, created_at DESC)
  WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX money_movements_topup_unique
  ON money_movements (topup_id)
  WHERE topup_id IS NOT NULL AND kind = 'merchant_topup';
CREATE UNIQUE INDEX money_movements_sale_kind_unique
  ON money_movements (sale_id, kind)
  WHERE sale_id IS NOT NULL;
