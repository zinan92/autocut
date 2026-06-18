#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def fmt_time(seconds):
    total_ms = int(round(float(seconds) * 1000))
    ms = total_ms % 1000
    total_s = total_ms // 1000
    s = total_s % 60
    total_m = total_s // 60
    m = total_m % 60
    h = total_m // 60
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    parser = argparse.ArgumentParser(description="Transcribe a video with local mlx-whisper.")
    parser.add_argument("input")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--model", default="mlx-community/whisper-large-v3-turbo")
    parser.add_argument("--language", default="zh")
    args = parser.parse_args()

    try:
        import mlx_whisper
    except Exception as exc:
        print(
            "mlx-whisper is not installed. Install with: pip3 install mlx-whisper",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 2

    input_path = Path(args.input).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    result = mlx_whisper.transcribe(
        str(input_path),
        path_or_hf_repo=args.model,
        language=args.language,
        word_timestamps=True,
        verbose=False,
    )

    words = []
    segments = []
    for segment in result.get("segments", []):
        seg = {
            "id": segment.get("id", len(segments)),
            "start": float(segment.get("start", 0)),
            "end": float(segment.get("end", 0)),
            "text": (segment.get("text") or "").strip(),
        }
        segments.append(seg)

        for word in segment.get("words") or []:
            text = (word.get("word") or word.get("text") or "").strip()
            if not text:
                continue
            words.append({
                "text": text,
                "start": float(word.get("start", seg["start"])),
                "end": float(word.get("end", seg["end"])),
            })

    transcript = {
        "source": str(input_path),
        "language": result.get("language", args.language),
        "text": (result.get("text") or "").strip(),
        "segments": segments,
        "words": words,
    }

    (out_dir / "transcript.json").write_text(
        json.dumps(transcript, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_dir / "transcript.txt").write_text(transcript["text"], encoding="utf-8")

    srt_lines = []
    srt_source = words if words else segments
    for index, item in enumerate(srt_source, 1):
        srt_lines.append(str(index))
        srt_lines.append(f"{fmt_time(item['start'])} --> {fmt_time(item['end'])}")
        srt_lines.append(item["text"])
        srt_lines.append("")
    (out_dir / "transcript.srt").write_text("\n".join(srt_lines), encoding="utf-8")

    print(json.dumps({
        "transcript": str(out_dir / "transcript.json"),
        "words": len(words),
        "segments": len(segments),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
