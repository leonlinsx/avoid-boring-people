#!/usr/bin/env python3
"""Generate one approved ABP narration locally with Qwen3-TTS CustomVoice.

Run only on a GPU workstation, in its own environment. First run downloads
open weights. This never clones someone else's voice or publishes content.
"""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--speaker", choices=("Ryan", "Aiden"), default="Ryan")
    parser.add_argument("--size", choices=("0.6B", "1.7B"), default="0.6B")
    parser.add_argument("--instruct", default="Speak clearly, thoughtfully and naturally. Avoid a sales pitch.")
    args = parser.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    # No network until the input is known to be structurally safe.
    from scripts.instagram_growth.render import validate_spec
    validate_spec(spec)

    import torch
    import soundfile as sf
    from qwen_tts import Qwen3TTSModel

    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU not available. Run on the local RTX 5070 Ti; don't fall back silently to CPU.")
    model_id = f"Qwen/Qwen3-TTS-12Hz-{args.size}-CustomVoice"
    model = Qwen3TTSModel.from_pretrained(
        model_id,
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )
    wavs, sample_rate = model.generate_custom_voice(
        text=spec["narration"],
        language="English",
        speaker=args.speaker,
        instruct=args.instruct,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(args.output), wavs[0], sample_rate)
    print(f"review-only output: {args.output} | model={model_id} speaker={args.speaker}")


if __name__ == "__main__":
    main()
