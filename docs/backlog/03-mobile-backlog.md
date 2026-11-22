# Mobile backlog · Esmaeel Mahfoud

React Native and Expo

## When to start

Start backlog implementation after the [live Android and web rehearsal and backend integration checks](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/HACKATHON_TASKS.md#demo-checks) both pass. The core rehearsal covers top-up, campaign launch, Expo join and share, customer QR issuance, merchant redemption, commission and cashback updates, and reserve release. The backend checks cover retries, concurrent QR issuance and redemption, final-sale closure, and monetary limits.

## First · Keep the Android demo ready for the voucher rehearsal

Verify on the Android device that the marketer can sign in, join an open campaign, share the server-provided referral link, and see the updated commission after a merchant confirms the sale. The customer and merchant redeem cashback vouchers on the web, so this extension has no new Expo screen.

## Esmaeel · Mobile backlog

| Suggested order | Task | When to connect it |
| --- | --- | --- |
| 1 | **Wallet history.** Show the marketer’s transaction list and amounts returned by the API. | When Laith publishes the wallet transaction examples and endpoint. |
| 2 | **Payout and receipt screens.** Submit a payout request, show its status and receipt, and provide the supported confirmation or dispute actions. | When the backend payout and receipt workflow and permissions are ready. |
| 3 | **Statistics and leaderboard.** Show API-supplied commission, conversion, sales and rankings. | When Laith publishes the stats and leaderboard responses. |

After the core checkpoint, Esmaeel can build the screens against shared examples while the voucher extension is built on the web. Test the connections on a physical Android device once their APIs are ready. Keep the shared Arabic RTL design, IBM Plex Sans Arabic, and the same status language as the web.

[Mobile ownership](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/tasks/03-mobile.md) · [Shared design](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/frontend/design.md) · [API contract](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/main/docs/handoff/API_CONTRACT.md)
