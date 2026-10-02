import { randomUUID } from "node:crypto";
import { InfraiClient } from "./infrai_client.ts";

type DomainAdded = { zone_id: string };
type DomainVerification = { status?: string; verified?: boolean };

export type TenantDomainInput = {
  tenantId: string;
  domain: string;
  deliveryTarget: string;
};

export type TenantDomainStarted = {
  onboardingId: string;
  zoneId: string;
  domain: string;
  verification: DomainVerification;
};

export async function startTenantDomainOnboarding(
  infrai: InfraiClient,
  input: TenantDomainInput,
): Promise<TenantDomainStarted> {
  const onboardingId = randomUUID();
  const added = await infrai.request<DomainAdded>("POST", "/v1/dns/domain/add", {
    body: {
      domain: input.domain,
      account_id: input.tenantId,
      metadata: { onboarding_id: onboardingId },
    },
  });

  await infrai.request("PUT", "/v1/dns/record/upsert", {
    body: {
      zone_id: added.zone_id,
      record_type: "CNAME",
      name: input.domain,
      content: input.deliveryTarget,
      ttl: 300,
      proxied: true,
      record_id: onboardingId,
      metadata: { tenant_id: input.tenantId },
    },
  });

  const verification = await infrai.request<DomainVerification>(
    "POST",
    "/v1/dns/domain/verify",
    { body: { domain: input.domain } },
  );

  return {
    onboardingId,
    zoneId: added.zone_id,
    domain: input.domain,
    verification,
  };
}

export async function registerDomainWebhook(
  infrai: InfraiClient,
  url: string,
  secret: string,
): Promise<unknown> {
  return infrai.request("POST", "/v1/account/webhooks/register", {
    body: {
      url,
      events: ["dns.domain.verified"],
      description: "Marks a school domain ready for course delivery",
      secret,
      retry_policy: { max_attempts: 6 },
    },
  });
}
