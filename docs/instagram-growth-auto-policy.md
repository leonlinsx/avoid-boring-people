# Autonomous ABP admission policy V1

Authority: the owner's November21 Phase4 revised request explicitly authorizes
automatic admission and routine publication without per-video human approval.
This is a new `AUTO_ADMITTED` contract, not a fabricated `approved_by` decision.
The earlier human review/exception workflow remains available and unchanged.

The producer, signed-data promotion, automatic-canary recovery and activation
boundaries are described in [the lifecycle runbook](instagram-growth-autonomous-lifecycle.md).

## Factual-quality standard, established before activation

Normal automatic content has one of two proofs:

1. A complete, short, source-exact paragraph of Leon's published, owned,
   nonquoted commentary, with an explicit topic question and spoken attribution.
   First-person prose is introduced as Leon's words; a fictional presenter is
   never represented as having lived his experiences. Every source sentence,
   uncertainty, negation and condition is preserved.
2. A versioned source-supported editorial reference from the context-revised
   examples. Exact script text, complete original file hashes and context anchors
   must match the canonical reference. The low-risk reference indices are fixed
   by policy; changing them requires a scoped code review and CI. Novel model
   assertions cannot enter this lane.

Both are attributed perspectives, not claims that all opinions in an essay are
scientifically established. Financial recommendations, medical/legal guidance,
numerical claims, unknown quotations, incomplete context, unpublished sources,
unbound visual/spoken claims and free-form paraphrases are exceptions. No source
or an LLM judge can approve its own unsupported addition. Numeric examples are
outside V1; arithmetic status is explicitly not applicable, never a pretend PASS.

Automatic acceptance requires zero altered assertions on the labeled mutation
tests, all sensitive reference cases rejected, and no direct admission of the
old raw/model drafts. The21 source-supported rewrites are positive context
examples; only the separately reconstructed low-risk reference subset can be
admitted. Historical failures are negative/exception cases, not relabeled good
to improve acceptance. A narrow acceptance rate is acceptable; no candidate is
forced through to fill inventory.

The independent consumer reconstructs the script from trusted main sources and
policy, rather than trusting the producer's boolean. The consumer also verifies
the dedicated Ed25519 attestation and public MP4 hash/ffprobe contract. Only the
public key is in Git. The local signing credential is mode0600, used only to
attest validated ABP media; it is not an Instagram token or code-push credential.

## Technical and rights standard

Use the existing pinned Kokoro voices, original graphics and licensed fictional
FlashHead Pro presenter/portrait. Model/reference hashes must match. No external
photos, music, clips or real-identity cloning. The source-exact lane rejects book
notes and ambiguous quotations; the reference lane uses original paraphrase
with source/author attribution. The AI label remains in-video and in Meta data.

Require complete decode,1080x1920 H264/yuv420p30fps, AAC48k, faststart,15–50s,
<=10MiB, conservative every-frame text bounds, integrated loudness -17 to-15LUFS,
true peak <=-1.5dBTP, no clipped source samples and measured word alignment.
Independent unprompted ASR must have <=12% normalized word error and preserve
critical condition/negation counts. Matched variants reuse the exact waveform
and word timings; they do not regenerate a different delivery.

Every receipt includes policy/runtime digests, source/claim/pair identity,
technical evidence, model provenance and signed content identity. Changed
source, policy, media, identity or signature is rejected, never silently repaired
at publication time. Repetition controls apply to claim IDs and near-duplicate
source passages as well as video hashes; a matched pair is the explicit two-member
exception. Repeated bad admission/rights evidence trips a circuit breaker.

## Shadow evidence before canary

The fresh city-priorities pair is compiled from a complete owned paragraph,
with a self-contained question and author attribution. The real RTX pipeline
rendered both variants; the initial independent ASR matched the narration exactly.
The labeled source/mutation/signature/technical-negative controls run in CI.
Autonomous promotion remains disabled until scoped CI and a bounded real canary
pass. A container ID is not a publish; media ownership, permalink, durable
receipts and available Insights are required before unrestricted activation.
