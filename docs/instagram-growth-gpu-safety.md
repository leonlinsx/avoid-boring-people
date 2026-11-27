# Durable hold after GPU device loss

The November 27 offline FlashHead verification crashed at 12:22:58 EST.
The first kernel event was Xid 79 (`GPU has fallen off the bus`), followed by
Xid 154 (`Node Reboot Required`). No PCIe AER precursor was logged in the
inspected 12:21–12:23 window. Narration and independent transcription completed;
the presenter failed during its first generation chunk around VAE decode.
No experimental pair was admitted, uploaded or published.

The exact hardware/driver cause is unresolved. NVIDIA describes Xid 79 as
loss of GPU access over PCI Express, and cautions that an Xid alone does not
establish an underlying cause.
[NVIDIA diagnostic guidance](https://docs.nvidia.com/deploy/xid-errors/archive/index.html#xid-79-gpu-has-fallen-off-the-bus)
is the reference; no driver, power/clock setting or kernel parameter was changed
and no further GPU stress test was run.

After reboot, the GPU was visible again. The installed factory timer is now
disabled/inactive, the service is inactive, and the existing private `PAUSE`
kill switch is present. The real installed launcher was exercised and refused
before Git fetch, models or uploads. Existing hosted inventory and GitHub
publication/measurement remain available. Recurring GPU replenishment is
**not currently operational**.

## The retry gap and scoped fix

The protected-base worker reports a rendering failure but does not persist a
hold if the device disappears. A reboot can therefore make a later scheduled
invocation try GPU generation again without resolving the fault.

The fix checks that `nvidia-smi` reports a valid device before the existing idle
check, and checks device availability after a renderer subprocess fails. A
missing device, failed/missing probe or probe timeout sets the existing `PAUSE`
file with owner-only permissions before stopping. It never overwrites an
owner's existing hold. A busy but accessible GPU remains an ordinary deferral
and does not set a persistent hold.

The same startup kill switch prevents a later healthy boot from automatically
resuming generation. Operator recovery and intentional clearing of the hold
are a genuine hardware exception, not per-Reel approval. This guard prevents
unattended retries after an observed device loss; it does not repair or prevent
the underlying GPU failure, nor supervise a manually invoked standalone model.
It never resets hardware, changes drivers, kills unrelated work or lowers QA.

## Verification

CPU-only tests simulate healthy idle/busy controls, missing/malformed device
responses, failed/timed-out probes, preservation of an existing owner hold and
device loss after a render failure. The real worker CLI path is exercised with
disposable fixtures and every GPU/model/provider call replaced. Exactly one
render is attempted, reservations stay spent, no media is uploaded, and restart
stops before any GPU query. The same regression fails against the protected base
specifically because `PAUSE` is absent. No additional GPU workload is necessary
to verify this safety transition.

The admission runtime digest remains
`46d3f4fae1c219e6f42e3a2b5b9318f6518deca7068bd8908bca29e7c0ed21a6`:
frozen signed assets, source/rights policy, publication limits and allocation
are unchanged. Publication evidence, the infrastructure hold, and validated
growth remain separate claims; no validated growth result is established.
