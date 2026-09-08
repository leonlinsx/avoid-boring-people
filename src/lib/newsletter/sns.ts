import { createVerify } from 'node:crypto';
import { get } from 'node:https';

export type SnsEnvelope = {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: '1' | '2';
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

type FetchLike = typeof fetch;

function getHttps(url: URL, signal: AbortSignal): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = get(url, { signal }, (response) => {
      let body = '';
      let bytes = 0;
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 65_536) request.destroy(new Error('SNS HTTPS response exceeds limit.'));
        else body += chunk;
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }));
    });
    request.on('error', reject);
  });
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`SNS message is missing ${field}.`);
  return value;
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return text(value, field);
}

export function parseSnsEnvelope(value: unknown): SnsEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SNS body must be an object.');
  const input = value as Record<string, unknown>;
  const type = text(input.Type, 'Type');
  if (type !== 'Notification' && type !== 'SubscriptionConfirmation' && type !== 'UnsubscribeConfirmation') {
    throw new Error('SNS message type is not supported.');
  }
  const envelope: SnsEnvelope = {
    Type: type,
    MessageId: text(input.MessageId, 'MessageId'),
    TopicArn: text(input.TopicArn, 'TopicArn'),
    Message: text(input.Message, 'Message'),
    Timestamp: text(input.Timestamp, 'Timestamp'),
    SignatureVersion: text(input.SignatureVersion, 'SignatureVersion') as SnsEnvelope['SignatureVersion'],
    Signature: text(input.Signature, 'Signature'),
    SigningCertURL: text(input.SigningCertURL, 'SigningCertURL'),
    Subject: optionalText(input.Subject, 'Subject'),
    SubscribeURL: optionalText(input.SubscribeURL, 'SubscribeURL'),
    Token: optionalText(input.Token, 'Token'),
  };
  if (envelope.SignatureVersion !== '1' && envelope.SignatureVersion !== '2') throw new Error('SNS signature version is not supported.');
  if (Number.isNaN(Date.parse(envelope.Timestamp))) throw new Error('SNS timestamp is invalid.');
  if (envelope.Type === 'SubscriptionConfirmation' && (!envelope.SubscribeURL || !envelope.Token)) {
    throw new Error('SNS subscription confirmation is incomplete.');
  }
  return envelope;
}

export function signingString(message: SnsEnvelope): string {
  const fields = message.Type === 'Notification'
    ? ['Message', 'MessageId', ...(message.Subject ? ['Subject'] : []), 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  return fields.map((field) => `${field}\n${message[field as keyof SnsEnvelope] ?? ''}\n`).join('');
}

function topicRegion(topicArn: string): string {
  const parts = topicArn.split(':');
  if (parts.length !== 6 || parts[0] !== 'arn' || parts[2] !== 'sns' || !parts[3]) {
    throw new Error('SNS TopicArn is invalid.');
  }
  return parts[3];
}

function snsUrl(value: string, region: string, certificate: boolean): URL {
  const url = new URL(value);
  const host = `sns.${region}.amazonaws.com`;
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password || url.hash) throw new Error('SNS URL is not from the expected AWS SNS endpoint.');
  if (certificate && (!url.pathname.startsWith('/SimpleNotificationService-') || !url.pathname.endsWith('.pem'))) {
    throw new Error('SNS signing certificate URL is invalid.');
  }
  return url;
}

export async function verifySnsEnvelope(
  message: SnsEnvelope,
  expectedTopicArn: string,
  fetchImpl?: FetchLike,
  deadline?: AbortSignal,
): Promise<void> {
  const signal = deadline ? AbortSignal.any([deadline, AbortSignal.timeout(4_000)]) : AbortSignal.timeout(4_000);
  if (!expectedTopicArn || message.TopicArn !== expectedTopicArn) throw new Error('SNS TopicArn is not expected.');
  const region = topicRegion(expectedTopicArn);
  const certificateUrl = snsUrl(message.SigningCertURL, region, true);
  const certificate = fetchImpl
    ? await fetchImpl(certificateUrl, { signal, redirect: 'error' }).then(async (response) => {
      if (!response.ok) throw new Error('SNS signing certificate could not be retrieved.');
      return response.text();
    })
    : await getHttps(certificateUrl, signal).then((response) => {
      if (response.status < 200 || response.status >= 300) throw new Error('SNS signing certificate could not be retrieved.');
      return response.body;
    });
  const verifier = createVerify(message.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1');
  verifier.update(signingString(message), 'utf8');
  verifier.end();
  if (!verifier.verify(certificate, message.Signature, 'base64')) throw new Error('SNS signature is invalid.');
}

export async function confirmSnsSubscription(message: SnsEnvelope, expectedTopicArn: string, fetchImpl?: FetchLike, deadline?: AbortSignal): Promise<void> {
  if (message.Type !== 'SubscriptionConfirmation' || !message.SubscribeURL) return;
  const url = snsUrl(message.SubscribeURL, topicRegion(expectedTopicArn), false);
  if (message.TopicArn !== expectedTopicArn || url.pathname !== '/' || url.searchParams.get('Action') !== 'ConfirmSubscription' || url.searchParams.get('TopicArn') !== expectedTopicArn || !message.Token || url.searchParams.get('Token') !== message.Token) {
    throw new Error('SNS subscription confirmation URL is not for the expected topic.');
  }
  const signal = deadline ? AbortSignal.any([deadline, AbortSignal.timeout(4_000)]) : AbortSignal.timeout(4_000);
  if (fetchImpl) {
    const response = await fetchImpl(url, { signal, redirect: 'error' });
    if (!response.ok) throw new Error('SNS subscription confirmation failed.');
    return;
  }
  const response = await getHttps(url, signal);
  if (response.status < 200 || response.status >= 300) throw new Error('SNS subscription confirmation failed.');
}
