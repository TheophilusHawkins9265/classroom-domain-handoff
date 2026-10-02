import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  buildEducatorReport,
  buildLearnerDeadlines,
  type Assignment,
  type Submission,
} from "./course_deadlines.ts";
import { InfraiClient, InfraiError } from "./infrai_client.ts";
import {
  registerDomainWebhook,
  startTenantDomainOnboarding,
  type TenantDomainInput,
} from "./tenant_domain_onboarding.ts";
import { hasValidWebhookSignature } from "./webhook_signature.ts";

const apiKey = process.env.INFRAI_API_KEY;
const webhookSecret = process.env.INFRAI_WEBHOOK_SECRET;
if (!apiKey || !webhookSecret) {
  throw new Error("INFRAI_API_KEY and INFRAI_WEBHOOK_SECRET are required");
}

const infrai = new InfraiClient(apiKey);
const app = express();
const domainStates = new Map<string, "verifying" | "ready">();

const onboardingBody = z.object({
  tenantId: z.string().min(1),
  domain: z.string().min(3),
  deliveryTarget: z.string().min(3),
});

const webhookRegistrationBody = z.object({ url: z.string().url() });
const deadlineBody = z.object({
  learnerId: z.string().min(1),
  now: z.string().datetime(),
  assignments: z.array(
    z.object({ id: z.string(), title: z.string(), dueAt: z.string().datetime() }),
  ),
  submissions: z.array(
    z.object({
      assignmentId: z.string(),
      learnerId: z.string(),
      submittedAt: z.string().datetime(),
    }),
  ),
});

app.post("/webhooks/infrai", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.header("x-infrai-signature") ?? "";
  if (!hasValidWebhookSignature(req.body, signature, webhookSecret)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  const event = JSON.parse(req.body.toString("utf8")) as {
    type?: string;
    data?: { domain?: string };
  };
  if (event.type === "dns.domain.verified" && event.data?.domain) {
    domainStates.set(event.data.domain, "ready");
  }
  res.status(204).send();
});

app.use(express.json());

app.post("/tenant-domains", async (req, res, next) => {
  try {
    const input = onboardingBody.parse(req.body);
    const result = await startTenantDomainOnboarding(infrai, input as TenantDomainInput);
    domainStates.set(input.domain, "verifying");
    res.status(202).json({ ...result, state: "verifying" });
  } catch (error) {
    next(error);
  }
});

app.get("/tenant-domains/:domain", (req, res) => {
  res.json({ domain: req.params.domain, state: domainStates.get(req.params.domain) ?? "unknown" });
});

app.post("/webhook-registration", async (req, res, next) => {
  try {
    const { url } = webhookRegistrationBody.parse(req.body);
    res.status(201).json(await registerDomainWebhook(infrai, url, webhookSecret));
  } catch (error) {
    next(error);
  }
});

app.post("/course-report", (req, res, next) => {
  try {
    const input = deadlineBody.parse(req.body);
    const deadlines = buildLearnerDeadlines(
      input.assignments as Assignment[],
      input.submissions as Submission[],
      input.learnerId,
      new Date(input.now),
    );
    res.json({ learnerId: input.learnerId, deadlines, report: buildEducatorReport(deadlines) });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", issues: error.issues });
    return;
  }
  if (error instanceof InfraiError) {
    const status = error.status >= 400 && error.status < 500 ? error.status : 502;
    res.status(status).json({ error: error.code, message: error.message });
    return;
  }
  res.status(500).json({ error: "Internal error" });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Educator portal listening on http://localhost:${port}`));
