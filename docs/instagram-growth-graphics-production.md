# GPU-accelerated graphics production

The unattended factory defaults to `production_mode: graphics_gpu`. It generates
source-grounded narrated motion graphics and rejects native presenter production.
FlashHead remains isolated and disabled; its hardware root cause is not a core
production dependency. Source/compiler policy, independent ASR/qualification checks,
media quality thresholds, rights, allocation, signatures, CAS, duplicate rejection,
account isolation and publication limits remain unchanged. No new service or paid
model is introduced. The compiler is deterministic, not an LLM factual generator;
an unvalidated local LLM is not introduced into automatic admission.

Kokoro narration and WhisperX/wav2vec2 alignment use the existing pinned CUDA
models. Independent faster-whisper small.en uses CUDA float16 with no prompt.
The already installed environment's CUDA12/cuDNN9 library paths are scoped to
children; the system CUDA13 installation is unchanged. Graphics, Pillow/FFmpeg
composition, encoding and orchestration remain on CPU. Stages execute serially;
no FlashHead process is created and no simultaneous model stages are scheduled.

## Holds and recovery

`PAUSE` remains an unconditional global/operator stop in both launcher and worker.
It is never removed by code. `GPU_FAULT.json` separately records the hardware
incident. Only an explicit owner configuration binding the exact incident bytes
with `validated_graphics_fault_sha256` permits a validated graphics workload after
that incident; this cannot enable presenter production. A new incident replaces
the fault record, creates a fresh `PAUSE` without overwriting an existing hold,
saves local diagnostics and stops the invocation. A healthy boot/probe never
clears either hold or reauthorizes the workload.

The November 27 incident-specific PAUSE may be classified into the separate fault
record only as an explicit operational recovery under the owner's authorization,
retaining its exact original bytes. A new/general operator PAUSE cannot be
classified automatically or ignored, including during normal scheduled execution.

Before GPU generation the existing idle-device check defers if another compute
process is present. Each inference stage is supervised with a 900-second timeout,
a 6144 MiB total device-use ceiling, half-second device/memory sampling and kernel
Xid inspection. Narration/alignment additionally cap PyTorch's process allocator
at 35% of device memory. Diagnostics record sampled device use separately from
PyTorch allocated/reserved peaks. A probe alone is never stability evidence.
The supervisor terminates only its own process group on budget/device failure.
A new device-loss/driver incident latches the factory before further work.

The existing worker lock, failed-attempt reservations (21 renders/40 attempts per
ISO week), maximum 21 unpublished inventory, three-failure circuit and 90-minute
invocation budget remain. The user service adds CPUQuota=400%, MemoryMax=8G and
TasksMax=128; no restart loop is configured. Existing inventory/factory health and
weekly follower-led measurement are reused. The timer is restored only after the
bounded production path passes. Human involvement remains weekly review and
real exceptions, never individual passing-Reel approval.

## Verification evidence

November 27 bounded local validation generated one real 19.4-second graphics Reel.
Kokoro allocated/reserved peaks were 916.29/1118 MiB; alignment peaks were
678.87/790 MiB. Sampled total device use peaked at 2414 MiB for audio and 2211 MiB
for GPU transcription (including desktop/device baseline, not per-model allocation).
No new kernel driver errors were observed. An initial transcription attempt failed
because CUDA12 libraries were not on its loader path; it recorded failure, and the
corrected child-only path completed using cached narration/alignment.

Independent ASR WER was 0.0371, all required qualifiers audible, loudness -16.28
LUFS and true peak -1.99 dBTP. Existing source/hash, exact captions with measured
word timings, decode, ffprobe, faststart, safe bounds and clipping checks passed.
No publication or follower-growth result is inferred from this local validation.
All 14 genuine prior signed admissions were also verified unchanged. Compatibility
accepts only the frozen legacy runtime plus its unchanged source/compiler policy;
arbitrary digests and edited source/scripts remain rejected.

Focused tests simulate device loss, driver errors, timeout, VRAM overflow, blocked
monitoring, exact incident authorization, an unconditional operator PAUSE, forbidden
presenter rendering/recovery and preservation of the legacy signature contract.
