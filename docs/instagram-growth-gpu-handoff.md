# Local RTX 5070 Ti — ABP Instagram GPU execution contract

Purpose: generate and **compare**, entirely locally, several creative treatments of Avoid Boring People essays. This is the handoff to an agent operating on the actual Linux workstation. It is not an instruction to publish.

**Constraints:** $0 additional spend; no API credits, hosted video endpoints, credential access, Instagram sessions, fake engagement, new domains, production deployment, or uploads. Do not repurpose @leon.lin.s personal Instagram videos, photos, or voice clips without explicit permission. Outputs are review-only and stay inside ignored .tmp/instagram-growth/ or another explicitly approved local scratch directory. Use an isolated Python environment and do not change system CUDA, ComfyUI environments, or unrelated repositories. Never upload faces or voice samples to external services.

## Step 0 — environmental and baseline audit

- Record date, git SHA, OS, GPU, driver, total and free VRAM, CUDA, PyTorch wheel/version, FFmpeg encoders, available disk, and the local ComfyUI version. On NVIDIA Blackwell, do not assume older CUDA wheels work.
- Check whether Qwen3-TTS, ComfyUI Wan 2.2 TI2V-5B, Z-Image-Turbo, FLUX.2-klein-4B, MuseTalk 1.5 or SoulX-FlashHead Lite weights are **already cached**. Reuse existing compatible models; don't duplicate multi-GB downloads.
- Confirm source facts and brief against published site: ergodicity (a 50/50 +50%/−40% multiplicative bet), Anthropic (approximately 36% *implied fee under assumptions*, not disclosed contract terms), Kelly (hypothetical 50/50, 11× payout, 45% Kelly).
- No changes to Instagram carousel cron, tokens, or default distribution. No automatic posting even if models run successfully.

## Step 1 — voices: benchmark three natural-sounding options

Use the checked scripts.instagram_growth/specs/ergodicity.json narration for equal comparison.

- Qwen3-TTS 0.6B CustomVoice (Ryan); repeat with Aiden. If output quality is marginal and VRAM permits, test 1.7B CustomVoice for the preferred speaker.
- If time allows, independently compare an MIT/Apache-licensed second engine such as Chatterbox or VoxCPM2 with the same script. Do not select a CC-BY-NC or research-only model solely because its demo sounds realistic.
- Capture a 15–30 second WAV for each and a subjective score for **intelligibility, expressiveness, number/proper-noun pronunciation, non-robotic pacing, and consistency**. Inspect clipping and waveform peaks. No voice cloning.

Stop if Blackwell compatibility is broken and document the exact incompatibility; never overwrite the user's working global Torch environment to fix it.

## Step 2 — captions and visual proof

- Produce a full 1080×1920 vertical export based on the Ergodicity article's arithmetic: +5% expectation for one bet, but a win followed by a loss leaves 90 cents. Show the calculation accurately.
- Add gentle timeline-based motion/animated data graphics using FFmpeg or Remotion. The existing Pillow slides are a baseline for layout only and are **not** a quality target for finished publication.
- Align subtitles to the **final voice waveform** with existing Faster-Whisper or WhisperX forced alignment. Manually correct number tokens and names and test safe zones against Instagram UI; do not approximate word timestamps from the planned written script.
- Check audio loudness, clean start/end, no clipped speech, subtitles remain clear without covering data, and video profile: 1080×1920 H.264/AVC + AAC, 24–30 fps and faststart. ffprobe the artifact. Include muted playback usability as well as audio playback.

## Step 3 — optional still-image and talking-presenter tests

- Image: compare one **fictional adult spokesperson** still or concept B-roll using Z-Image Turbo and FLUX.2-klein-4B via existing ComfyUI, with fixed prompt/seed recorded. Ensure portrait is not recognizably any real public or private person; save provenance/model/license and prompt. Any factual writing or financial graph must be drawn in the editor, never trusted to a diffusion model.
- Avatar: animate an **original/rights-cleared** presenter reference for 5–8 seconds using MuseTalk 1.5 or SoulX-FlashHead Lite (if feasible within 16 GB). Pair with locally generated narration. Do not imply the presenter is Leon or a human professional who researched the article. Clearly disclose the synthetic character where required.
- Model fit: if a model demands more VRAM than available, skip after one bounded compatibility attempt; do not buy compute or introduce obscure quantized checkpoints of unknown provenance.
- B-roll: test one 3–5 second Wan 2.2 TI2V-5B ComfyUI offloading pass if it adds explanatory value; no fabricated depictions of Anthropic filings, actual people or news footage.

## Deliverables and scoring

At minimum create:
1. One **narrated, accurately captioned** data explainer (benchmark).
2. One different voice/caption treatment of the same underlying point.
3. If viable, one short fictional avatar introduction cut into the factual explainer.
4. One still-image or generative B-roll treatment *only if visually useful*.

For each asset, save a local manifest with: git SHA, article URL, exact narration text, scene durations, model identifier and version, license, prompt/seed when relevant, voice, wall time, GPU peak VRAM if measured, ffprobe metadata, file hash, rights notes, and editorial-review status. The output filenames should plainly say REVIEW_ONLY. Give a side-by-side contact sheet and score each 1–5 for hook effectiveness, visual trust, aesthetic originality, subtitle correctness, audio naturalness, and repeatability. Label model inference and quality as **tested only when actually run**.

Do not merge a publishing adapter, change a live profile or post any material. Hold for a human review of the first candidate. Once the user chooses a repeatable winning format, implement a narrowly scoped official Instagram Reel uploader and aggregate analytics separately, preserving the existing anti-duplicate protections.
