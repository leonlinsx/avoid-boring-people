# GPU incident during offline creative verification

On November 27, 2026 at 12:22:58 EST (17:22:58 UTC), the NVIDIA kernel
driver recorded Xid 79, `GPU has fallen off the bus`, while the offline
FlashHead Pro presenter test was running. This was the source-first matched
pair at code commit `c02664ce3a71e88d87af0f89112314421a46940f`.

The test completed Kokoro narration and independent transcription, then failed
during the first FlashHead generation chunk after four denoising steps, around
the VAE decode/synchronization stage. It produced no final admitted pair,
uploaded nothing and published nothing. The CUDA error was followed by
invalid-device and MMU/TLB driver errors. No CUDA out-of-memory error was
recorded in the test log. The failed run's peak memory was not captured.

NVIDIA defines Xid 79 as the driver losing access to the GPU over PCI Express;
the Xid alone does not determine whether the underlying cause is hardware,
power/PCIe or driver/software behavior.
[NVIDIA's Xid guidance](https://docs.nvidia.com/deploy/xid-errors/archive/index.html#xid-79-gpu-has-fallen-off-the-bus)
and [current diagnostic procedure](https://docs.nvidia.com/deploy/xid-errors/latest/analyzing-xid-catalog.html)
require retaining the event context before choosing recovery actions.

The affected environment reported an RTX 5070 Ti and driver 595.99.02.
The requested native opening was 5.923 seconds at 512 by 768 pixels. Earlier
successful factory outputs used the same dimensions and openings of 5.880 and
5.741 seconds, with about 7,682 MiB peak allocation. A longer-opening regression
is therefore not established; those earlier results do not prove this workload
safe on the machine. The exact underlying cause remains unresolved.

The machine rebooted at 12:26 EST and the GPU became visible again. The agent
then stopped its factory service and timer before the next 12:30 tick. No GPU
reset, clock/power change, driver installation or further GPU stress test was
performed. The timer was subsequently disabled, the existing private `PAUSE`
kill switch was created, and the installed launcher refused before Git/model
work. The hold now survives login/reboot; host recovery remains an operator
exception.

Already hosted and independently admitted inventory is unaffected: the last
verified state had twelve unpublished assets, and GitHub-hosted publication and
measurement do not require the local GPU. Recurring GPU replenishment is paused,
so earlier successful infrastructure proofs must not be presented as current
unattended GPU availability. No new experimental asset passed live admission.

CPU verification at the tested code commit passed 985 Python tests, npm test,
lint and the Astro build. These checks do not validate GPU stability. The
creative integration must remain a draft until its missing media verification
and the GPU availability exception are resolved. There is no validated growth
result or verified external outlier dataset.

## CPU-only completion of the graphics treatment

At head `be796892e309450fdf6279a6fc1ccd84906d5988`, the graphics-only treatment
was rendered and verified with GPU devices hidden and OpenCL disabled. It reused
the exact narration waveform, measured timings and independent ASR completed
before the crash; it launched no new voice/model/presenter workload. The actual
23.5-second MP4 passed decode, codec/format, faststart, source hash, caption timing,
clipping, safe bounds and independent ASR (WER 0.0, qualifiers audible), at
-16.36 LUFS and -1.99 dBTP. SHA-256:
`9f183ed0c431e300cfa9cb4ee88274fb05ecf935b54aa013ed2229a011b09a0d`.
Admission/verification used a disposable signing key; nothing was uploaded or
published. This verifies the graphics path, not a complete matched format pair
or GPU stability. Native presenter verification remains incomplete.
