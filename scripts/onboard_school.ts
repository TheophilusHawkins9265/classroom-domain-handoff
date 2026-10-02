import { InfraiClient } from "../src/infrai_client.ts";
import { startTenantDomainOnboarding } from "../src/tenant_domain_onboarding.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const result = await startTenantDomainOnboarding(new InfraiClient(apiKey), {
  tenantId: process.env.TENANT_ID ?? "school-42",
  domain: process.env.SCHOOL_DOMAIN ?? "learn.example.edu",
  deliveryTarget: process.env.DELIVERY_TARGET ?? "courses.example.net",
});

console.log(JSON.stringify(result, null, 2));
