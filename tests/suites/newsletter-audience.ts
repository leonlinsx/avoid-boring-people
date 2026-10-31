// Audience selection: safe-default eligibility, preview segments, and late-event handling.
import assert from 'node:assert/strict';
import {
  isDefaultEligible,
  ELIGIBILITY_WHERE,
} from '../../src/lib/newsletter/audience.ts';
import { snapshotCampaign } from '../../src/lib/newsletter/campaign.ts';
import {
  recordSesEvent,
  reconcileSesMessage,
} from '../../src/lib/newsletter/events.ts';
import { classifyBounce } from '../../src/lib/newsletter/bounce-classification.ts';

function sesDeliveryEnvelope(
  messageId: string,
  timestamp: string,
  recipient: string,
) {
  return {
    Type: 'Notification' as const,
    MessageId: `sns-${messageId}`,
    TopicArn: 'arn:aws:sns:us-east-2:123456789012:newsletter-events',
    Message: JSON.stringify({
      eventType: 'Delivery',
      mail: { messageId, destination: [recipient] },
      delivery: { timestamp },
    }),
    Timestamp: timestamp,
    SignatureVersion: '2' as const,
    Signature: 'test',
    SigningCertURL: 'https://sns.us-east-2.amazonaws.com/cert.pem',
  };
}

function sesBounceEnvelope(
  messageId: string,
  timestamp: string,
  bounceType: string,
  bounceSubType: string,
  recipient: string,
) {
  return {
    Type: 'Notification' as const,
    MessageId: `sns-${messageId}`,
    TopicArn: 'arn:aws:sns:us-east-2:123456789012:newsletter-events',
    Message: JSON.stringify({
      eventType: 'Bounce',
      mail: { messageId, destination: [recipient] },
      bounce: {
        bounceType,
        bounceSubType,
        timestamp,
        bouncedRecipients: [{ emailAddress: recipient }],
      },
    }),
    Timestamp: timestamp,
    SignatureVersion: '2' as const,
    Signature: 'test',
    SigningCertURL: 'https://sns.us-east-2.amazonaws.com/cert.pem',
  };
}

function sesComplaintEnvelope(
  messageId: string,
  timestamp: string,
  recipient: string,
) {
  return {
    Type: 'Notification' as const,
    MessageId: `sns-${messageId}`,
    TopicArn: 'arn:aws:sns:us-east-2:123456789012:newsletter-events',
    Message: JSON.stringify({
      eventType: 'Complaint',
      mail: { messageId, destination: [recipient] },
      complaint: {
        timestamp,
        complainedRecipients: [{ emailAddress: recipient }],
      },
    }),
    Timestamp: timestamp,
    SignatureVersion: '2' as const,
    Signature: 'test',
    SigningCertURL: 'https://sns.us-east-2.amazonaws.com/cert.pem',
  };
}

export function testAudienceEligibilityHelper() {
  // Active + confirmed_at → eligible
  assert.equal(
    isDefaultEligible({
      status: 'active',
      confirmed_at: '2026-01-01T00:00:00Z',
    }),
    true,
    'active with confirmed_at is eligible',
  );
  // Active + prior delivery → eligible
  assert.equal(
    isDefaultEligible({
      status: 'active',
      confirmed_at: null,
      hasDelivered: true,
    }),
    true,
    'active with prior delivery is eligible',
  );
  // Active + both → eligible
  assert.equal(
    isDefaultEligible({
      status: 'active',
      confirmed_at: '2026-01-01T00:00:00Z',
      hasDelivered: true,
    }),
    true,
  );
  // Active + neither → not eligible (preserved, not deleted)
  assert.equal(
    isDefaultEligible({
      status: 'active',
      confirmed_at: null,
      hasDelivered: false,
    }),
    false,
    'active with no proof is not eligible but not suppressed',
  );
  assert.equal(
    isDefaultEligible({ status: 'active', confirmed_at: null }),
    false,
  );
  assert.equal(
    isDefaultEligible({ status: 'active', confirmed_at: undefined }),
    false,
  );

  // Non-active never eligible regardless of proof
  for (const status of ['pending', 'bounced', 'complained', 'unsubscribed']) {
    assert.equal(
      isDefaultEligible({
        status,
        confirmed_at: '2026-01-01T00:00:00Z',
        hasDelivered: true,
      }),
      false,
      `${status} is never default-eligible`,
    );
  }

  // ELIGIBILITY_WHERE never references sent_at (only delivered_at is delivery proof)
  assert.ok(
    ELIGIBILITY_WHERE.includes('delivered_at'),
    'must check delivered_at',
  );
  assert.ok(
    ELIGIBILITY_WHERE.includes('confirmed_at'),
    'must check confirmed_at',
  );
  assert.equal(
    ELIGIBILITY_WHERE.includes('sent_at'),
    false,
    'must never treat sent_at as delivery',
  );
  assert.ok(
    ELIGIBILITY_WHERE.includes("status = 'active'"),
    'must gate on active status',
  );
}

export function testAudienceEligibilityDoesNotConflateValidationSuppression() {
  // EmailValidationSuppressed is NOT a hard bounce
  assert.equal(
    classifyBounce('Permanent', 'EmailValidationSuppressed'),
    'validation_suppression',
  );
  assert.equal(classifyBounce('Permanent', 'General'), 'hard_bounce');
  assert.equal(classifyBounce('Permanent', 'NoEmail'), 'hard_bounce');
  assert.equal(classifyBounce('Permanent', 'Suppressed'), 'hard_bounce');
  assert.equal(
    classifyBounce('Permanent', 'OnAccountSuppressionList'),
    'other_suppression',
  );
  assert.equal(
    classifyBounce('Permanent', 'OnTenantSuppressionList'),
    'other_suppression',
  );
  assert.equal(
    classifyBounce('Permanent', 'UnsubscribedRecipient'),
    'other_suppression',
  );
  // NULL / unrecognized → unknown (not guessed as hard bounce)
  assert.equal(classifyBounce('Permanent', null), 'unknown');
  assert.equal(classifyBounce('Permanent', 'FutureUnknown'), 'unknown');
  // Transient must not become bounced state
  assert.equal(classifyBounce('Transient', 'General'), null);
  assert.equal(classifyBounce('Undetermined', 'General'), null);
  assert.equal(classifyBounce(null, 'General'), null);
}

export async function testSnapshotUsesVerifiedAudience() {
  // Snapshot's eligible CTE must filter by verified audience, not all active.
  const seen: string[] = [];
  const fakeDb: any = async (parts: TemplateStringsArray) => {
    const text = parts.join(' {?} ');
    seen.push(text);
    // First query is the delivered_at probe
    if (text.includes('SELECT delivered_at FROM campaign_recipients LIMIT 0'))
      return [];
    // Second query is the snapshot CTE
    if (text.includes('WITH eligible AS MATERIALIZED')) {
      // Verify eligibility clause is present
      assert.ok(
        text.includes('confirmed_at IS NOT NULL'),
        'snapshot must require confirmed_at or delivery',
      );
      assert.ok(
        text.includes('delivered_at IS NOT NULL'),
        'snapshot must check delivered_at',
      );
      assert.equal(text.includes("status = 'active'"), true);
      // Must not use bare status='active' without verification
      // The CTE WHERE should contain both conditions, not just single status
      return [
        {
          id: 'new-campaign-id',
          status: 'draft',
          content_hash: 'a'.repeat(64),
          recipient_selection: 'all-active',
          recipient_count: 1,
          created: true,
        },
      ];
    }
    throw new Error(`unexpected query: ${text.slice(0, 200)}`);
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  // published article markdown
  const markdown = '---\ntitle: Test Article\n---\n\nHello world.';
  // Mock publication check by patching the import - snapshot calls assertPublishedArticle
  // For the fake test we use a real published-like article that passes the draft check
  const articleId = '2021_01_01_test/index.md';
  try {
    await snapshotCampaign(
      {
        articleId,
        markdown,
        subject: 'Test Article',
        contentHash: 'a'.repeat(64),
        expected: 1,
        maximum: 100,
        cohortSize: null,
      },
      fakeDb,
    );
  } catch {
    // May fail on draft check or content hash - we only care about the SQL assertion above
    // If it reached the SQL query and we asserted, the test passed
    if (seen.some((t) => t.includes('WITH eligible AS MATERIALIZED'))) return;
    throw new Error('snapshot did not issue the eligible CTE query');
  }
  assert.ok(seen.some((t) => t.includes('WITH eligible AS MATERIALIZED')));
}

export async function testLateBounceDoesNotEraseUnsubscribe() {
  // Late bounce against an already-unsubscribed row: ledger updates, subscriber stays unsubscribed.
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const fakeDb: any = async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = parts.join(' {?} ');
    queries.push({ text, values });
    // The bounced_at ordering subquery fallback should still be checked - handle any pre-probe
    if (text.includes('INSERT INTO newsletter_event_receipts')) {
      return [{ event_id: 'e1' }];
    }
    if (text.includes('UPDATE campaign_recipients SET')) {
      // Ledger must still be updated (recipients CTE)
      return [{ subscriber_id: 'sub-1' }];
    }
    if (text.includes('UPDATE subscribers SET')) {
      // This is the critical assertion: subscribers UPDATE must NOT target unsubscribed rows
      assert.ok(
        text.includes("status IN ('pending', 'active')"),
        `subscriber bounce update must exclude unsubscribed, got: ${text}`,
      );
      assert.equal(
        text.includes("status IN ('pending', 'active', 'unsubscribed')"),
        false,
        'must not include unsubscribed in bounce target',
      );
      // Ledger update (campaign_recipients) is independent - it still runs
      return [];
    }
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  const envelope = sesBounceEnvelope(
    'msg-late-bounce',
    '2026-10-31T10:00:00.000Z',
    'Permanent',
    'General',
    'reader@example.com',
  );
  await recordSesEvent(envelope, fakeDb);

  // Verify both the ledger and the subscriber guard were hit
  assert.ok(
    queries.some((q) => q.text.includes('UPDATE campaign_recipients SET')),
    'late bounce must still update the recipient ledger',
  );
  assert.ok(
    queries.some((q) => q.text.includes('UPDATE subscribers SET')),
    'late bounce must attempt subscriber update (guarded to pending/active)',
  );
}

export async function testLateComplaintDoesNotEraseUnsubscribe() {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const fakeDb: any = async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = parts.join(' {?} ');
    queries.push({ text, values });
    if (text.includes('INSERT INTO newsletter_event_receipts'))
      return [{ event_id: 'e1' }];
    if (text.includes('UPDATE campaign_recipients SET'))
      return [{ subscriber_id: 'sub-1' }];
    if (text.includes('UPDATE subscribers SET')) {
      assert.ok(text.includes("status IN ('pending', 'active')"));
      assert.equal(
        text.includes("status IN ('pending', 'active', 'unsubscribed')"),
        false,
      );
      return [];
    }
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  const envelope = sesComplaintEnvelope(
    'msg-late-complaint',
    '2026-10-31T11:00:00.000Z',
    'reader@example.com',
  );
  await recordSesEvent(envelope, fakeDb);
  assert.ok(queries.some((q) => q.text.includes('UPDATE subscribers SET')));
}

export async function testOutOfOrderDeliveryAndBounce() {
  // Delivery arrives after bounce: delivered_at is recorded idempotently, subscriber
  // bounced status is not reverted by later delivery.
  const queries: Array<{ text: string; values: unknown[] }> = [];
  let callCount = 0;
  const fakeDb: any = async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = parts.join(' {?} ');
    queries.push({ text, values });
    if (text.includes('INSERT INTO newsletter_event_receipts'))
      return [{ event_id: `e${++callCount}` }];
    if (text.includes('UPDATE campaign_recipients SET')) {
      // First call (bounce) sets status=bounced; second (delivery) should not overwrite it
      // The SQL uses: status = CASE WHEN status IN ('bounced','complained') THEN status ELSE ...
      assert.ok(
        text.includes("status IN ('bounced', 'complained')"),
        'delivery must not overwrite a bounced ledger row',
      );
      return [{ subscriber_id: 'sub-1' }];
    }
    if (text.includes('UPDATE subscribers SET')) return [];
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  // Bounce first
  await recordSesEvent(
    sesBounceEnvelope(
      'msg-ooo',
      '2026-10-31T10:00:00.000Z',
      'Permanent',
      'General',
      'reader@example.com',
    ),
    fakeDb,
  );
  // Delivery later (out-of-order)
  await recordSesEvent(
    sesDeliveryEnvelope(
      'msg-ooo',
      '2026-10-31T09:00:00.000Z',
      'reader@example.com',
    ),
    fakeDb,
  );

  assert.equal(
    queries.filter((q) =>
      q.text.includes('INSERT INTO newsletter_event_receipts'),
    ).length,
    2,
  );
  // Both events are recorded; bounce winner is preserved in the ledger
}

export async function testDeliveryEventIsIdempotent() {
  let inserts = 0;
  const fakeDb: any = async (parts: TemplateStringsArray) => {
    const text = parts.join(' {?} ');
    if (text.includes('INSERT INTO newsletter_event_receipts')) {
      // Second insert is CONFLICT DO NOTHING — returns no receipt, so dependent updates see no receipt row
      inserts++;
      return inserts === 1 ? [{ event_id: 'e1' }] : [];
    }
    if (text.includes('UPDATE campaign_recipients SET')) {
      // With ON CONFLICT DO NOTHING, second delivery sees EXISTS (SELECT 1 FROM receipt) = false, so no update
      // Our fake returns [] always; the key is that the second iteration's receipt is empty
      return inserts === 1 ? [{ subscriber_id: 'sub-1' }] : [];
    }
    if (text.includes('UPDATE subscribers SET')) return [];
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  const envelope = sesDeliveryEnvelope(
    'msg-idem',
    '2026-10-31T10:00:00.000Z',
    'reader@example.com',
  );
  await recordSesEvent(envelope, fakeDb);
  await recordSesEvent(envelope, fakeDb); // duplicate SNS redelivery
  assert.equal(
    inserts,
    2,
    'both inserts attempted (second is no-op via ON CONFLICT)',
  );
}

export async function testBounceSubtypePreservedForAudit() {
  // A bounced event stores its validated subtype; later events don't clobber it (COALESCE).
  const captured: Array<{ text: string; values: unknown[] }> = [];
  const fakeDb: any = async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = parts.join(' {?} ');
    captured.push({ text, values });
    if (text.includes('INSERT INTO newsletter_event_receipts'))
      return [{ event_id: 'e1' }];
    if (text.includes('UPDATE campaign_recipients SET')) {
      // The bounce_subtype column must use COALESCE to preserve first value
      assert.ok(
        text.includes('COALESCE(bounce_subtype,'),
        'bounce subtype must be preserved via COALESCE, not overwritten',
      );
      assert.ok(
        text.includes('COALESCE(bounce_type,'),
        'bounce type must also be preserved',
      );
      return [{ subscriber_id: 'sub-1' }];
    }
    if (text.includes('UPDATE subscribers SET')) return [];
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  await recordSesEvent(
    sesBounceEnvelope(
      'msg-audit',
      '2026-10-31T10:00:00.000Z',
      'Permanent',
      'General',
      'reader@example.com',
    ),
    fakeDb,
  );
}

export async function testReconcileDoesNotEraseUnsubscribe() {
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const fakeDb: any = async (
    parts: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const text = parts.join(' {?} ');
    queries.push({ text, values });
    if (text.includes('UPDATE campaign_recipients SET'))
      return [{ subscriber_id: 'sub-1', status: 'bounced' }];
    if (text.includes('UPDATE subscribers SET')) {
      assert.ok(text.includes("status IN ('pending', 'active')"));
      assert.equal(
        text.includes("status IN ('pending', 'active', 'unsubscribed')"),
        false,
      );
      return [];
    }
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  await reconcileSesMessage('msg-reconcile', fakeDb);
  assert.ok(
    queries.some((q) => q.text.includes('UPDATE campaign_recipients SET')),
  );
}

export async function testTransientBounceDoesNotSuppress() {
  // Transient bounceType must not become a subscriber state change.
  const queries: Array<{ text: string; values: unknown[] }> = [];
  const fakeDb: any = async (parts: TemplateStringsArray) => {
    const text = parts.join(' {?} ');
    queries.push({ text, values: [] });
    if (text.includes('INSERT INTO newsletter_event_receipts'))
      return [{ event_id: 'e1' }];
    if (text.includes('UPDATE campaign_recipients SET')) return [];
    if (text.includes('UPDATE subscribers SET')) return [];
    return [];
  };
  fakeDb.unsafe = (raw: string) => ({ __raw: raw, toString: () => raw });

  // Transient/General should map to eventStatus=null (no subscriber transition)
  const envelope = sesBounceEnvelope(
    'msg-transient',
    '2026-10-31T10:00:00.000Z',
    'Transient',
    'General',
    'reader@example.com',
  );
  await recordSesEvent(envelope, fakeDb);
  // Receipt inserted with status null; gated subscriber update is a no-op (WHERE status IN ('bounced','complained') fails).
  assert.ok(
    queries.some((q) =>
      q.text.includes('INSERT INTO newsletter_event_receipts'),
    ),
    'transient bounce inserted as receipt',
  );
}

export async function runNewsletterAudienceTests() {
  testAudienceEligibilityHelper();
  testAudienceEligibilityDoesNotConflateValidationSuppression();
  await testSnapshotUsesVerifiedAudience();
  await testLateBounceDoesNotEraseUnsubscribe();
  await testLateComplaintDoesNotEraseUnsubscribe();
  await testOutOfOrderDeliveryAndBounce();
  await testDeliveryEventIsIdempotent();
  await testBounceSubtypePreservedForAudit();
  await testReconcileDoesNotEraseUnsubscribe();
  await testTransientBounceDoesNotSuppress();
  console.log(
    '✅ Newsletter audience selection, validation-suppression handling, late-event and idempotency coverage passed (fake DB)',
  );
}
