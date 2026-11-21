# Avoid Boring People — Instagram Creative Lab (November 2026)

**Review-only. No content is uploaded, no account is edited, and no production workflow is activated.**

Account: **@avoidboringpeople** (28 posts, 0 followers as reported November 20). **@leon.lin.s** is the separate personal account; its 418 followers and Elena Lev metrics must never be combined with ABP's numbers.

Goal: test ways to turn organic reach into genuine followers, leonlins.com visits and owned newsletter subscribers, with effectively $0 incremental software spend.

## What is implemented

- Three source-verified creative briefs: Ergodicity, Anthropic IPO channel-fee inference, and Kelly bet sizing. Exact published source URLs are included with every brief.
- scripts/instagram_growth/render.py: a deterministic offline 1080x1920 H.264 MP4 layout renderer, using Pillow and FFmpeg, three color treatments, readable claims, constrained safe zones, and a review receipt.
- scripts/instagram_growth/tts_qwen.py: optional local synthetic speech with Qwen3-TTS CustomVoice, Ryan or Aiden, 0.6B or 1.7B. No voice cloning.
- tests/test_instagram_growth.py: validates approved article sources, safe slugs, scene limits, runtime, and the offline/no-publishing boundary.
- All outputs are previews requiring human creative review. A silent text-scene MP4 is **not** an AI-voiced, captioned, publish-ready Reel.

## Generate the first video previews

From the repository root on Linux, install only Pillow into an isolated environment; FFmpeg/ffprobe and open Lato/DejaVu fonts must also be available locally:

~~~sh
python -m venv .venv-ig-render
. .venv-ig-render/bin/activate
python -m pip install Pillow
python -m scripts.instagram_growth.render scripts/instagram_growth/specs/ergodicity.json --variant ink --output .tmp/instagram-growth/risk-ink --preview
python -m scripts.instagram_growth.render scripts/instagram_growth/specs/ergodicity.json --variant paper --output .tmp/instagram-growth/risk-paper --preview
python -m scripts.instagram_growth.render scripts/instagram_growth/specs/anthropic.json --variant signal --output .tmp/instagram-growth/anthropic --preview
python -m pytest tests/test_instagram_growth.py -q
~~~

This uses no API credentials, model weights or paid services. Preview frames, MP4, narration text and review receipt are written only to the output directory.

## Local RTX 5070 Ti speech benchmark

Use a **separate** environment from the existing website and ComfyUI projects. First verify the Blackwell-compatible PyTorch/CUDA build: nvidia-smi and torch.cuda.is_available() must report the card.

Follow the official Qwen3-TTS install instructions in https://github.com/QwenLM/Qwen3-TTS. In the isolated Qwen environment with the correct PyTorch wheel:

~~~sh
python -m pip install qwen-tts soundfile
python -m scripts.instagram_growth.tts_qwen scripts/instagram_growth/specs/ergodicity.json --size 0.6B --speaker Ryan --output .tmp/instagram-growth/voice-ryan.wav
python -m scripts.instagram_growth.tts_qwen scripts/instagram_growth/specs/ergodicity.json --size 0.6B --speaker Aiden --output .tmp/instagram-growth/voice-aiden.wav
~~~

Then listen and select the better voice before muxing it with render.py --audio. The renderer rejects narration too long for its scene timeline instead of truncating it. Shorten script or retime scenes if needed. The first run downloads weights and may need Blackwell-specific dependency adjustments; **not yet benchmarked on the user's machine**.

## Tooling recommendations, verified against upstream documentation

| Job | Default for first test | Alternative / constraint |
| --- | --- | --- |
| Synthetic voice | Qwen3-TTS CustomVoice, 0.6B then 1.7B (Apache-2.0) | Chatterbox (MIT) or VoxCPM2 (Apache-2.0); verify specific weights |
| Motion graphics | Remotion + FFmpeg | The included Pillow renderer is only a baseline; implement richer data animation after selecting a visual direction |
| True word-level subtitles | Faster-Whisper, WhisperX forced alignment if needed, then @remotion/captions | Validate each proper noun and timestamp; don't obscure the lower Instagram UI |
| Generated image / fictional avatar seed | FLUX.2 [klein] 4B or Z-Image Turbo with ComfyUI (Apache-2.0) | Never ask an image model to render exact financial figures as text |
| Short generative B-roll | Wan 2.2 TI2V 5B through ComfyUI offloading | HunyuanVideo 1.5 and LTX-2.3 only after memory and license checks |
| Animated fictional presenter | MuseTalk 1.5 with owned image/video and synthesized speech | SoulX-FlashHead Lite is a low-VRAM alternative with quality compromises; many 2026 avatar models require >16 GB |
| Baseline one-click generator | MoneyPrinterTurbo **offline comparison only** | Do not connect paid APIs or auto-publish generic stock-footage videos |

Primary references:
- Qwen3-TTS: https://github.com/QwenLM/Qwen3-TTS
- ComfyUI Wan 2.2: https://docs.comfy.org/tutorials/video/wan/wan2_2
- MuseTalk: https://github.com/TMElyralab/MuseTalk
- SoulX-FlashHead: https://github.com/Soul-AILab/SoulX-FlashHead
- Z-Image Turbo: https://huggingface.co/Tongyi-MAI/Z-Image-Turbo
- FLUX.2: https://github.com/black-forest-labs/flux2
- Remotion captions: https://www.remotion.dev/docs/captions
- WhisperX: https://github.com/m-bain/whisperX
- MoneyPrinterTurbo: https://github.com/harry0703/MoneyPrinterTurbo

All synthetic people must be clearly fictional and disclosed where required. Never suggest a synthetic presenter personally wrote or researched the article, and never clone an actual person's image or voice without permission.

## Broader creative experiments: explore widely, publish selectively

The [November 21 rolling-batch protocol](instagram-growth-rolling-batches.md)
replaces the earlier twelve-treatment/six-post ceiling with 24 source-anchored
concepts across eight articles, rolling observation windows, and independent
confirmation on fresh material. This is the current planning direction; API
publishing/measurement integration and live authorization remain outstanding.
The three-article examples below describe the earlier creative screen:

- Ergodicity: ink typography, high-contrast signal typography, true animated math/diagram via Remotion, fictional avatar hook followed by charts.
- Anthropic: numerical motion-graphic story, fictional avatar, AI-generated editorial visual B-roll with verified figures overlaid, one striking image-led post.
- Kelly: paper typography, animated bet sizing diagram, human-narrated analysis if recorded voluntarily, fictional avatar.

The three palettes are not three genuinely different growth hypotheses by themselves. They are styling choices; stronger tests compare a face, original research shown visually, clear charts, narration and information density. Generate substantive alternatives in batches; release distinct reviewed stories under a bounded account-specific plan. Neither a few posts per week nor dozens per day is established here as an optimal cadence.

Each published asset must have an approved source/claim ledger, media-license provenance, audio and captions quality gate, and approval to post. Keep original and synthetic voices, appearance, and rights recorded separately. The personal account's footage is not automatically reusable.

## Measure the actual funnel

Before publishing: record ABP account status, recommendation eligibility, last-30-day reach, profile visits, followers, and stable tagged bio link. Test Trial Reels only if **this ABP account's** interface offers it.

At 48 hours and seven days per post record: non-follower reach, 3-second retention and mean watch duration if available, shares/saves, profile visits, new followers, website sessions and signups. Mark unmeasured as missing, not zero. Evaluate **follows per 1,000 reached**, profile visits per reach and shares per reach alongside downstream signups.

Use manual publishing for the first reviewed pieces. Automatic Reel upload, metadata measurement, and a platform-specific evergreen cadence change are **future gated work**; the current social scheduler and other platforms remain untouched.

## What is not done

The November 20 local GPU pass now supersedes the earlier untested status:

- RTX 5070 Ti inference was exercised in ignored, isolated environments with
  Torch 2.10.0+cu128. The existing ComfyUI Torch 2.6.0+cu124 could not execute
  `sm_120` kernels and was preserved unchanged.
- Qwen Ryan/Aiden voices were tested and rejected by the reader. Kokoro Heart
  was selected after comparison with Nicole, Qwen VoiceDesign and VoxCPM2 female
  voices. No real voice was cloned.
- MuseTalk on a still image was rejected because the upper face/head were static.
  FlashHead Pro generated full-frame blinks, brow/head/shoulder movement. A 6.48s
  512×512 test took about 45s with 6.15 GiB peak Torch allocation; a 512×768 test
  took about 75s with 7.50 GiB allocation / 9.85 GiB reservation. These are short
  local tests, not a promise of realism or long-shot stability.
- Cached Z-Image model files were matched against official hashes. The fictional
  presenter, exact scripts, models/licenses, timing, allocator measurements,
  ffprobe data, file hashes and rights notes are recorded in ignored local
  manifests. Native presenter output is lower-resolution than its 1080×1920
  editor export; upscaling is not native 1080p generation.
- WhisperX forced alignment and independent Faster-Whisper transcription were
  run on the actual voice waveforms. Earlier full review exports passed complete
  decode, metadata, loudness and arithmetic checks. Technical passage is not an
  Instagram growth result or full human playback approval.

The next controlled creative screen is
[ABP-REELS-001](instagram-growth-reels-v1.json), with process and launch gates in
[the experiment document](instagram-growth-experiment.md). All model weights,
renders and runtime observations remain in ignored `.tmp/instagram-growth/`.
There is no Instagram dashboard connection, no live growth dataset, no uploader
activation and no publication or schedule change. The first-party account's
eligibility, phone overlay/playback and actual performance still need to be
checked through a separately approved launch.
