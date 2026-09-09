import { createHmac } from 'node:crypto';

export type ProductionSendConfig = {
  awsRegion: string;
  configurationSet: string;
  maxRecipients: number;
  unsubscribeSecret: string;
};

export type SesAccountState = {
  productionAccessEnabled?: boolean;
  sendingEnabled?: boolean;
  max24HourSend?: number;
  maxSendRate?: number;
  sentLast24Hours?: number;
};

function positiveInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer. No email was sent.`);
  return parsed;
}

export function productionSendConfig(env: NodeJS.ProcessEnv): ProductionSendConfig {
  if (env.NEWSLETTER_ENVIRONMENT !== 'production') {
    throw new Error('NEWSLETTER_ENVIRONMENT must be exactly "production". No email was sent.');
  }
  if (!env.AWS_REGION || !env.SES_CONFIGURATION_SET) {
    throw new Error('AWS_REGION and SES_CONFIGURATION_SET are required. No email was sent.');
  }
  if (!env.NEWSLETTER_UNSUBSCRIBE_SECRET || Buffer.byteLength(env.NEWSLETTER_UNSUBSCRIBE_SECRET) < 32) {
    throw new Error('NEWSLETTER_UNSUBSCRIBE_SECRET must contain at least 32 bytes. No email was sent.');
  }
  return {
    awsRegion: env.AWS_REGION,
    configurationSet: env.SES_CONFIGURATION_SET,
    maxRecipients: positiveInteger(env.NEWSLETTER_MAX_PRODUCTION_RECIPIENTS, 'NEWSLETTER_MAX_PRODUCTION_RECIPIENTS'),
    unsubscribeSecret: env.NEWSLETTER_UNSUBSCRIBE_SECRET,
  };
}

export function parseExpectedRecipients(value: string | undefined): number {
  return positiveInteger(value, '--expect-recipients');
}

export function assertRecipientScope(expected: number, actual: number, maximum: number): void {
  if (actual !== expected) throw new Error(`Recipient count changed: expected ${expected}, found ${actual}. No email was sent.`);
  if (actual > maximum) throw new Error(`Recipient count ${actual} exceeds the configured maximum ${maximum}. No email was sent.`);
}

export function assertSesAccountReady(account: SesAccountState, recipients: number): { delayMs: number } {
  if (account.productionAccessEnabled !== true) throw new Error('SES production access is not enabled. No email was sent.');
  if (account.sendingEnabled !== true) throw new Error('SES account sending is disabled. No email was sent.');
  const max24HourSend = account.max24HourSend ?? 0;
  const sentLast24Hours = account.sentLast24Hours ?? 0;
  const maxSendRate = account.maxSendRate ?? 0;
  if (maxSendRate <= 0 || max24HourSend - sentLast24Hours < recipients) {
    throw new Error('SES quota is insufficient for this campaign. No email was sent.');
  }
  return { delayMs: Math.max(1, Math.ceil(1_000 / Math.min(maxSendRate, 10))) };
}

export function subscriberUnsubscribeToken(subscriberId: string, secret: string): string {
  return createHmac('sha256', secret).update(`newsletter-unsubscribe:${subscriberId}`).digest('base64url');
}
