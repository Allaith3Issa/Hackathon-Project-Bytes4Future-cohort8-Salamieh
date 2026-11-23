# Mardood backend review

Reviewed `main` at `059888d` on November 23, 2026. For Allaith and Laith. [Reviewed commit](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/commit/059888d)

## Fix first · Web users share authentication rate limits

**Found in code.** NestJS allows 10 requests per minute per IP on each authentication route. Next.js sends those requests to NestJS from the web server without passing a trusted client identity. Users routed through the same web server IP therefore share the allowance for each route, including login and session refresh. The hosted impact was outside the local review. [Auth module](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/api/src/auth/auth.module.ts#L12) · [Web API client](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/web/lib/api.ts#L18)

**Coordinate with Alaa and Tayma.** Agree where the rate limit is enforced and how that boundary identifies web clients. Keep throttling in place for repeated requests from the same client. Verify that separate users on the same Next.js instance can log in and refresh independently, and that a client which reaches its limit still receives `429 RATE_LIMITED`.

## Measure later · Merchant dashboard scans sales twice

**Confirmed with PostgreSQL query plans.** The dashboard scans sales once for merchant totals and again to identify the top campaign. Both queries completed in under 1 ms on the local fixture. The review found duplicate work, with no measured user-visible slowdown. [Reporting queries](https://github.com/Allaith3Issa/Hackathon-Project-Bytes4Future-cohort8-Salamieh/blob/059888d/api/src/reporting/reporting.service.ts#L90)

**Next step.** Measure the endpoint with a representative sales volume before changing the query or adding indexes. If it is slow, compare the plans before and after the change and verify that totals and top-campaign results match.

## Verification

- The API production dependency audit reported zero known advisories.
- Backend lint and all 145 backend tests, including the PostgreSQL integration suites, passed in the preceding check on this same commit.
- Query timings are from the local fixture. Hosted behavior and production load were outside the review.
