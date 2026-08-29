#!/usr/bin/env python3
"""Build pixel-aligned idle and blink frames for Teacher Kim.

The source speaking frames are the approved R2 character images.  This script
only edits small facial regions, so the body, pose, crop and transparent matte
remain identical between frames and do not jump during animation.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw


FACE_ANCHORS = {
    "greeting": {
        "mouth": (312, 150, 22, 12),
        "eyes": ((278, 106), (345, 106)),
    },
    "explaining": {
        "mouth": (237, 153, 25, 15),
        "eyes": ((200, 110), (267, 110)),
    },
    "encouraging": {
        "mouth": (237, 153, 25, 15),
        "eyes": ((200, 110), (267, 110)),
    },
}


def inpaint_ellipse(image: Image.Image, center: tuple[int, int], radii: tuple[int, int]) -> Image.Image:
    rgba = np.array(image)
    bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)
    mask = np.zeros(rgba.shape[:2], dtype=np.uint8)
    cv2.ellipse(mask, center, radii, 0, 0, 360, 255, -1)
    repaired = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    repaired_rgb = cv2.cvtColor(repaired, cv2.COLOR_BGR2RGB)
    rgba[:, :, :3] = repaired_rgb
    return Image.fromarray(rgba, "RGBA")


def build_idle(source: Image.Image, mouth: tuple[int, int, int, int]) -> Image.Image:
    mouth_x, mouth_y, mouth_rx, mouth_ry = mouth
    result = inpaint_ellipse(source, (mouth_x, mouth_y), (mouth_rx, mouth_ry))
    draw = ImageDraw.Draw(result)
    mouth_color = (132, 66, 63, 255)
    points = [
        (mouth_x - 11, mouth_y),
        (mouth_x - 6, mouth_y + 2),
        (mouth_x, mouth_y + 3),
        (mouth_x + 6, mouth_y + 2),
        (mouth_x + 11, mouth_y),
    ]
    draw.line(points, fill=mouth_color, width=2, joint="curve")
    return result


def build_blink(idle: Image.Image, eyes: tuple[tuple[int, int], tuple[int, int]]) -> Image.Image:
    result = idle.copy()
    for eye_x, eye_y in eyes:
        result = inpaint_ellipse(result, (eye_x, eye_y), (15, 10))
    draw = ImageDraw.Draw(result)
    for eye_x, eye_y in eyes:
        eyelid_color = (91, 48, 43, 255)
        points = [
            (eye_x - 11, eye_y + 1),
            (eye_x - 5, eye_y + 4),
            (eye_x, eye_y + 5),
            (eye_x + 5, eye_y + 4),
            (eye_x + 11, eye_y + 1),
        ]
        draw.line(points, fill=eyelid_color, width=2, joint="curve")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for pose, anchors in FACE_ANCHORS.items():
        source_path = args.source_dir / f"{pose}-speaking.png"
        source = Image.open(source_path).convert("RGBA")
        if source.size != (512, 1024):
            raise ValueError(f"{source_path} must be exactly 512x1024")
        idle = build_idle(source, anchors["mouth"])
        blink = build_blink(idle, anchors["eyes"])
        idle.save(args.output_dir / f"{pose}-idle.png", optimize=True)
        blink.save(args.output_dir / f"{pose}-blink.png", optimize=True)


if __name__ == "__main__":
    main()
