CREATE TABLE cashback_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customer_profiles(user_id),
  amount_syp bigint NOT NULL CHECK (
    amount_syp BETWEEN 1 AND 9007199254740991
  ),
  qr_token text NOT NULL UNIQUE,
  voucher_code varchar(32) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'redeemed', 'cancelled')
  ),
  redeemed_by_merchant_id uuid REFERENCES merchant_profiles(user_id),
  redeemed_bill_total_syp bigint CHECK (
    redeemed_bill_total_syp IS NULL
    OR redeemed_bill_total_syp BETWEEN 1 AND 9007199254740991
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  CONSTRAINT cashback_voucher_redemption_fields_check CHECK (
    (
      status = 'redeemed'
      AND redeemed_by_merchant_id IS NOT NULL
      AND redeemed_bill_total_syp IS NOT NULL
      AND redeemed_at IS NOT NULL
    )
    OR (
      status <> 'redeemed'
      AND redeemed_by_merchant_id IS NULL
      AND redeemed_bill_total_syp IS NULL
      AND redeemed_at IS NULL
    )
  )
);

CREATE INDEX cashback_vouchers_customer_created_idx
  ON cashback_vouchers (customer_id, created_at DESC, id DESC);
CREATE INDEX cashback_vouchers_active_customer_idx
  ON cashback_vouchers (customer_id, created_at DESC)
  WHERE status = 'active';

CREATE TABLE payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES users(id),
  wallet_id uuid NOT NULL REFERENCES wallets(id),
  amount_syp bigint NOT NULL CHECK (
    amount_syp BETWEEN 1 AND 9007199254740991
  ),
  method text NOT NULL CHECK (
    method IN ('sham_cash', 'syriatel_cash', 'cash')
  ),
  account_details text NOT NULL CHECK (
    length(account_details) BETWEEN 1 AND 500
  ),
  status text NOT NULL DEFAULT 'pending_review' CHECK (
    status IN ('pending_review', 'transferred', 'confirmed', 'disputed', 'rejected')
  ),
  transfer_reference text,
  transfer_receipt_url text,
  transferred_at timestamptz,
  confirmed_at timestamptz,
  dispute_reason text,
  rejection_reason text,
  dispute_resolution_outcome text CHECK (
    dispute_resolution_outcome IS NULL
    OR dispute_resolution_outcome IN ('confirm_paid', 'return_funds')
  ),
  dispute_resolution_note text,
  reversal_reference text,
  dispute_resolved_by_admin_id uuid REFERENCES users(id),
  dispute_resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payout_requests_marketer_created_idx
  ON payout_requests (marketer_id, created_at DESC, id DESC);
CREATE INDEX payout_requests_status_created_idx
  ON payout_requests (status, created_at DESC, id DESC);
CREATE UNIQUE INDEX payout_requests_transfer_reference_unique
  ON payout_requests (method, transfer_reference)
  WHERE transfer_reference IS NOT NULL;
CREATE UNIQUE INDEX payout_requests_reversal_reference_unique
  ON payout_requests (method, reversal_reference)
  WHERE reversal_reference IS NOT NULL;

CREATE TABLE payout_receipt_files (
  payout_id uuid PRIMARY KEY REFERENCES payout_requests(id),
  content_type text NOT NULL CHECK (
    content_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  file_data bytea NOT NULL CHECK (octet_length(file_data) BETWEEN 1 AND 5242880),
  uploaded_by_admin_id uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE money_movements
  ADD CONSTRAINT money_movements_payout_fk
    FOREIGN KEY (payout_id) REFERENCES payout_requests(id),
  ADD CONSTRAINT money_movements_voucher_fk
    FOREIGN KEY (voucher_id) REFERENCES cashback_vouchers(id);

CREATE UNIQUE INDEX money_movements_payout_kind_unique
  ON money_movements (payout_id, kind)
  WHERE payout_id IS NOT NULL;
CREATE UNIQUE INDEX money_movements_voucher_kind_unique
  ON money_movements (voucher_id, kind)
  WHERE voucher_id IS NOT NULL;
