# Three-day hackathon roadmap

**Team 3 · Affiliate Marketing Platform**

All five teammates start on Day 1. A handoff means the next teammate can start integrating while the first teammate moves to the next task. The checkpoints are relative to your team’s kickoff. Use the [task split](HACKATHON_TASKS.md), [API contract](API_CONTRACT.md), and [ERD](DATABASE_ERD.md) as shared references.

## Day 1 · Build in parallel

**First hour.** Allaith leads a short kickoff. Agree on the shared demo data, the API examples, who owns each change, and the Basic and Pro demo prices. Alaa and Tayma align the first web screens with `frontend/design.md` when available. They can start API integration while the design is being finalized.

| Member | Start | Stop and hand off |
| --- | --- | --- |
| **Allaith Issa** | Set up NestJS, PostgreSQL, migrations, and Swagger. Build login and seed demo accounts, one campaign, and an approved referral. Start merchant verification and campaign joining. | Share sample payloads in the first hour with **Laith, Alaa, Tayma, and Esmail**. By day’s end, share a working local login, repeatable seed steps, and the referral test data. |
| **Laith Alhaj Husain** | Start the in-store checkout transaction using the agreed referral and campaign data. Implement capacity checks, simulated settlement, wallet credits, and receipt issuance. | Hand **Alaa and Tayma** a checkout and receipt example early. Finish the day with a seeded successful checkout and a receipt that can be used for integration. |
| **Alaa Esmail** | Set up the Next.js app, shared API client, and web sign-in. Build the referral page, quantity selection from API options, checkout, and receipt screens against the examples. | Share the web session and client setup with **Tayma**. Hand **Esmail** the public referral URL pattern. By day’s end, show a mocked customer purchase and receipt. |
| **Tayma Watfa** | Build admin verification, merchant campaign creation and preview, marketer approval, and receipt-number lookup against the examples. | Share the first merchant and admin routes with **Alaa**. By day’s end, show the mocked merchant flow from verification through receipt lookup and list API gaps for **Allaith and Laith**. |
| **Esmail Mahfoud** | Start the Android app, emulator or device, marketer login, campaign browse, join and share. Use the API samples while live endpoints are being built. | Show **Alaa and Allaith** an Android build that can open the shared web referral URL. Record which steps still use mock data. |

**Day 1 checkpoint.** All three apps have a runnable starting point. Everyone has the same seed data, request examples, and named owner for each unfinished endpoint. Start with the consumer’s highest-impact blocker if a handoff slips.

## Day 2 · Connect the first complete sale

| Member | Start | Stop and hand off |
| --- | --- | --- |
| **Allaith Issa** | Finish live merchant verification, campaign creation, marketer approval, public offers and click tracking. Integrate with Laith’s checkout. | **By midpoint**, Alaa and Tayma can use live auth and campaign endpoints, and Esmail can join and share a real link. Then finish plan rules and verify backend hosting feasibility. |
| **Laith Alhaj Husain** | Finish live checkout, receipt lookup and single-use redemption. Verify retries and the payout amounts. | **By midpoint**, Alaa can issue a receipt and Tayma can redeem it once. Then connect the online order acceptance and rejection paths, refunds, wallet history, and reporting. |
| **Alaa Esmail** | Connect real referrals, checkout and receipts as the APIs land. | Prove a simulated purchase from Esmail’s Android link and give Tayma the receipt. Then connect online checkout, marketer web screens and the public leaderboard. |
| **Tayma Watfa** | Connect verification, campaign creation, marketer approval, and receipt-number redemption as the APIs land. | Verify and publish the demo campaign, approve Esmail’s marketer, and redeem Alaa’s receipt. Then connect QR scanning, online orders, wallet, plans and admin views. |
| **Esmail Mahfoud** | Switch login, browse, join and sharing from examples to the live API. | Share a real referral with Alaa and confirm the purchase appears in Android earnings. Then finish wallet, stats, and leaderboard integration. |

**Day 2 checkpoint.** Run one complete sale together before polishing other flows. Tayma verifies the merchant, publishes the campaign, and approves the marketer. Esmail shares the link. Alaa buys through that link and hands the receipt to Tayma for redemption. Check that Laith’s settlement shows the same earnings on web and Android. If the flow stalls, Allaith assigns the blocker to its owner and the rest of the team continues independent work.

## Day 3 · Finish, freeze and rehearse

| Member | Start | Stop point |
| --- | --- | --- |
| **Allaith Issa** | Review open PRs, resolve contract issues, and check plan limits, campaign closing, seed data, and release readiness. | Tag or record the working demo revision and lead the final rehearsal. |
| **Laith Alhaj Husain** | Test order acceptance and rejection, full refunds, stock and budget release, duplicate payment attempts, and receipt reuse. | Prove money and limits stay consistent. Hand Allaith the results and any known issues. |
| **Alaa Esmail** | Finish marketer and public web screens. Check guest checkout, ended offers, and readable errors against the real API. | Run the customer demo on the chosen web URL and hand over the exact referral and checkout steps. |
| **Tayma Watfa** | Finish merchant and admin screens, then verify QR scan, receipt-number entry, order actions, plans, and dashboard values. | Confirm the merchant demo can be completed from navigation and provide the admin and merchant steps. |
| **Esmail Mahfoud** | Finish Android integration and build the demo app against the chosen API URL. | Verify the installed build can sign in, share a link, and show the resulting earnings. Share the build and demo steps with Allaith. |

**Final two hours.** Stop starting features. Merge fixes for broken requirements or demo blockers, lock the demo build and seed data, and rehearse the English presentation with every member. Use the [task split’s demo checks](HACKATHON_TASKS.md#demo-checks) to confirm the release.

## How to hand work over

Use a focused PR on your branch. In its description, give the next owner the branch or PR link, working endpoints or screens, how to run them, example data, what you tested, and what is still missing. Call out any mock-only behavior. The receiving teammate runs one relevant check and confirms they can continue. Raise a contract mismatch to Allaith before either client works around it.

## Netlify checkpoint

- **Day 1 · Allaith and Laith.** Check whether the team’s Netlify account can use **Netlify Server** for NestJS. It is in Early Access and requires Node.js 24 or later. Plan one Netlify project for the API and a separate one for the Next.js frontend from the same repository, since the Next.js adapter handles server routes on its own project. Decide which PostgreSQL instance the API demo will use. [Netlify Server overview](https://docs.netlify.com/build/server/) · [Server setup and runtime](https://docs.netlify.com/build/server/get-started/) · [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- **Day 2 · Allaith, Laith and Alaa.** Once hosting setup starts and the local sale works, test a preview API with a database-backed request, then connect a web preview. Give Tayma and Esmail both URLs and check that Android-shared links open the web preview. If hosting slips, keep the working local demo available for rehearsal.
- **Day 3 · Team.** Rehearse against the final URLs if they’re ready. Check login, sharing, payment, receipt redemption, and wallet updates using the installed Android build and the hosted web app together.

The deployment walkthrough will cover project configuration, secrets, migrations, and publishing separately.
