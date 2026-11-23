# Mardood backend handoff for Allaith Issa

Reviewed against `main` at `059888d`. Your core demo backend work is merged, and all 145 backend tests passed on local PostgreSQL. Registration and admin merchant verification also passed. If Alaa and Tayma still need examples for those two features, send them the existing Swagger requests and responses.

## First · Coordinate cashback vouchers with Laith

1. Confirm whether the team has completed the live Android and web rehearsal. The backend checks passed, and the local web smoke test passed through QR redemption and customer purchase history. The live Android rehearsal still needs confirmation before starting backlog implementation. Use the [demo checklist](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888df2701327f4719634d81bf8ee9c774c142/docs/handoff/HACKATHON_TASKS.md#demo-checks).
2. Walk through the existing voucher contract with Laith. Agree on the request and response examples for issuance, cancellation, scanner lookup, and redemption, including a bill that is too small, a duplicate redemption, and a retry. Share the agreed examples with Alaa and Tayma.
3. Agree on a demo seed with a customer who has at least **50.00 new SYP** available and a second verified merchant who can redeem the voucher. Run the acceptance check together once the endpoints are ready. A **50.00** voucher on a **200.00** bill should return `customerPaidCashSyp: 15000` and credit the merchant **5000** minor units exactly once. A bill below the voucher value should leave the voucher active. Cancellation should restore the reservation once.

You coordinate the contract, examples, seed, and rehearsal. **Laith implements voucher issuance, cancellation, and redemption**, including the balance and ledger changes.

## Next · Implement approval-based campaign joining

- Allow `approval_required` campaigns. A marketer who joins enters `pending`. The campaign owner can list participants and approve or reject the membership through the documented participant endpoints.
- Expose a referral link only after approval. Keep the existing open-join flow working and make repeated join requests reuse the existing membership.
- Test the pending, approved, and rejected states, owner-only decisions, repeat joins, and whether the link resolves only after approval. Share the resulting API examples with Esmaeel and the web team.

## Then · Implement merchant direct referrals

- Add campaign configuration for enabling merchant direct referrals. Return a shareable `directReferralUrl` for eligible campaigns when enabled. Use a distinct code prefix from marketer links.
- Resolve the direct code through the existing public referral flow and carry merchant-direct attribution into Offer QR issuance.
- Coordinate with Laith on the attribution fields and verify the checkout end to end together. A merchant-direct purchase should accrue the applicable customer cashback and produce zero marketer commission. Cover disabled and ended campaigns, and confirm existing marketer referral links still work.

## Then · Implement store-discount campaign pricing and preview

- Extend campaign configuration, preview, and launch to support `store_discount`, percentage commission, and `maxSalesVolumeSyp`. Use integer minor units. Preview should show the expected reserve and whether the merchant can afford it. Launch should lock that reserve atomically and preserve idempotent retries.
- **Before coding checkout integration**, agree with Laith on shared pricing inputs and outputs, rounding, fees, cashback, reserve deductions, and errors. The sales cap counts the cash amount **after the store discount**. Checkout should reject a purchase above the remaining cap while keeping the pass active. At the cap, checkout closes the campaign and releases any unused reserve in the sale transaction.
- You own campaign-side pricing, configuration, preview, launch, and reserve locking. **Laith owns scanner preview and redemption for store discounts.** Run shared integration cases for exact-cap and over-cap purchases, insufficient reserve, launch or checkout retries, and unchanged product-campaign behavior.

## Small documentation follow-up

Update the backend guide’s access-token lifetime from **15 minutes** to **30 minutes** to match the merged implementation and tests.

[Backend backlog and ownership](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888df2701327f4719634d81bf8ee9c774c142/docs/backlog/02-backend-backlog.md) · [API contract](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888df2701327f4719634d81bf8ee9c774c142/docs/handoff/API_CONTRACT.md)
