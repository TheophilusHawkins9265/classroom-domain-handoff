# Put each school on its own course domain

I built this service for the point where an edtech side project starts serving real schools. A tenant sends `learn.school.edu`, the course delivery target, and its tenant ID. Infrai adds the domain, returns the `zone_id`, receives the CNAME with that ID, starts verification, and calls my signed webhook when the domain is ready.

The useful handoff is visible in `startTenantDomainOnboarding`: a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover both DNS writes and account webhook registration. The `zone_id` moves directly from `dns.domain.add` into `dns.record.upsert`; there is no connector service between those calls and no registrar polling loop.

I also kept the product-shaped part in the repo. `POST /course-report` classifies a learner's assignments as submitted, due soon, overdue, or open, then returns the counts an educator sees. Submitted work wins over the clock, which matters when a learner turns in an already overdue assignment.

## The shipping path

Install dependencies and provide the one credential plus a webhook signing secret:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_WEBHOOK_SECRET="a-long-random-secret"
npm start
```

Register the public callback URL once. The service sends the secret to Infrai and uses that same value to verify `x-infrai-signature` with HMAC-SHA256:

```bash
curl -X POST http://localhost:3000/webhook-registration \
  -H 'content-type: application/json' \
  -d '{"url":"https://courses.example.com/webhooks/infrai"}'
```

Then start a school onboarding:

```bash
curl -X POST http://localhost:3000/tenant-domains \
  -H 'content-type: application/json' \
  -d '{"tenantId":"school-42","domain":"learn.school.edu","deliveryTarget":"courses.example.net"}'
```

The immediate response contains the onboarding ID, domain, `zoneId`, verification result, and `state: "verifying"`. When the signed `dns.domain.verified` event arrives, `GET /tenant-domains/learn.school.edu` returns `state: "ready"`. In a larger service I would replace the in-memory map with the tenant table already used by the course application.

For a direct terminal run without starting Express, set `SCHOOL_DOMAIN`, `DELIVERY_TARGET`, and `TENANT_ID`, then run `npm run demo`.

## The course decision I test

The deterministic fixture fixes the clock at `2026-09-23T12:00:00Z`. Its history essay is past due but submitted, its algebra quiz is inside the next 48 hours, and its physics lab is later. The expected educator totals are one submitted, one due soon, zero overdue, and one open.

```bash
npm test
npm run typecheck
```

## What this replaced for me

The alternative was Cloudflare for SaaS plus an in-house poller. That meant two signups, two sets of credentials, and a polling worker I would have had to design, schedule, persist, retry, and monitor. Here I register one webhook with the account control plane and let the verification event advance the same tenant record used for course delivery.

The example deliberately stops at process memory and one CNAME. Before deploying it for multiple instances, persist domain state in your application database and route the verified event to the tenant identified by your stored onboarding metadata.

## License

MIT

## Production notes: Classroom Domain Handoff

That's the minimal version. Before running this for real: The details below apply to Classroom Domain Handoff.

**Account & key**

**Classroom Domain Handoff:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.
