#!/usr/bin/env python3
"""Generate one Teacher Kim speech chunk and word-boundary timing metadata."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


async def generate(text: str, voice: str, rate: str, output: Path, cues: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, boundary="WordBoundary")
    boundaries: list[dict[str, object]] = []
    search_from = 0

    with output.open("wb") as audio_file:
        async for event in communicate.stream():
            if event["type"] == "audio":
                audio_file.write(event["data"])
                continue
            if event["type"] != "WordBoundary":
                continue
            word = str(event.get("text", ""))
            character_start = text.find(word, search_from)
            if character_start < 0:
                character_start = search_from
            character_end = min(len(text), character_start + len(word))
            search_from = character_end
            boundaries.append({
                "startMs": round(int(event["offset"]) / 10_000),
                "endMs": round((int(event["offset"]) + int(event["duration"])) / 10_000),
                "charStart": character_start,
                "charEnd": character_end,
                "text": word,
            })

    cues.write_text(json.dumps(boundaries, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--rate", default="+0%")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cues", type=Path, required=True)
    args = parser.parse_args()
    asyncio.run(generate(args.text, args.voice, args.rate, args.output, args.cues))


if __name__ == "__main__":
    main()
