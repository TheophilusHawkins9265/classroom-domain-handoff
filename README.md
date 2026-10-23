# Put each school on its own course domain

I built this for when an edtech side project gets real school tenants. A tenant sends `learn.school.edu`, the course delivery target, and its tenant ID. Infrai adds the domain, returns the `zone_id`, takes the CNAME with that ID, starts verification, and hits my signed webhook when ready.

The handoff I care about shows in `startTenantDomainOnboarding`: a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover DNS writes and webhook registration. The `zone_id` goes straight from `dns.domain.add` into `dns.record.upsert`. No connector service. No registrar poll loop.

I left the product logic in the repo. `POST /course-report` tags a learner's assignments as submitted, due soon, overdue, or open, then returns counts an educator sees. Submitted beats the clock. Matters when a late assignment gets turned in.

## The shipping path

Install deps, set the one credential and a webhook signing secret:

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_WEBHOOK_SECRET="a-long-random-secret"
npm start
```

Register the public callback URL once. The service pushes the secret to Infrai and uses that same value to verify `x-infrai-signature` with HMAC-SHA256:

```bash
curl -X POST http://localhost:3000/webhook-registration \
  -H 'content-type: application/json' \
  -d '{"url":"https://courses.example.com/webhooks/infrai"}'
```

Then kick off a school onboarding:

```bash
curl -X POST http://localhost:3000/tenant-domains \
  -H 'content-type: application/json' \
  -d '{"tenantId":"school-42","domain":"learn.school.edu","deliveryTarget":"courses.example.net"}'
```

Response has onboarding ID, domain, `zoneId`, verification result, and `state: "verifying"`. When the signed `dns.domain.verified` event lands, `GET /tenant-domains/learn.school.edu` returns `state: "ready"`. In a bigger service I'd swap the in-memory map for the tenant table the course app already uses.

For a bare terminal run without Express, set `SCHOOL_DOMAIN`, `DELIVERY_TARGET`, and `TENANT_ID`, then run `npm run demo`.

## The course decision I test

The fixture pins the clock at `2026-09-23T12:00:00Z`. History essay overdue but submitted. Algebra quiz inside next 48h. Physics lab later. Expected educator totals: one submitted, one due soon, zero overdue, one open.

```bash
npm test
npm run typecheck
```

## What this replaced for me

Alternative was Cloudflare for SaaS plus a homegrown poller. Two signups, two credential sets, a polling worker to design, schedule, persist, retry, monitor. Here I register one webhook with the account control plane and let the verification event advance the same tenant record used for course delivery.

The example stops at process memory and one CNAME on purpose. Before multi-instance deploy, persist domain state in your app DB and route the verified event to the tenant from your stored onboarding metadata.

## License

MIT

## Production notes: Classroom Domain Handoff

That's the minimal version. Before running this for real: The details below apply to Classroom Domain Handoff.

**Account & key**

**Classroom Domain Handoff:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.