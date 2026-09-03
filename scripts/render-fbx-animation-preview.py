#!/usr/bin/env python3
"""Render a front-view PNG sequence for an animated FBX."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args() -> tuple[Path, Path]:
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(values) != 2:
        raise SystemExit("Usage: blender --background --python script.py -- INPUT_FBX OUTPUT_DIR")
    return Path(values[0]), Path(values[1])


def add_area_light(name: str, location: tuple[float, float, float], energy: float, size: float) -> None:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 2.2)) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main() -> None:
    source, output = args()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source))
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == "MESH" and len(o.data.vertices) > 8]
    points = [o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
    center = Vector((
        (min(p.x for p in points) + max(p.x for p in points)) / 2,
        (min(p.y for p in points) + max(p.y for p in points)) / 2,
        (min(p.z for p in points) + max(p.z for p in points)) / 2,
    ))
    height = max(p.z for p in points) - min(p.z for p in points)

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 1.18
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((0, -8, height * 0.05))
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera

    world = bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (0.035, 0.035, 0.045, 1)
    background.inputs["Strength"].default_value = 0.55
    add_area_light("Key", (4, -5, 6), 1200, 4)
    add_area_light("Fill", (-4, -2, 3.5), 800, 3)
    add_area_light("Rim", (1.5, 3, 5), 900, 2.5)

    action = next(iter(bpy.data.actions))
    start, end = (round(action.frame_range[0]), round(action.frame_range[1]))
    scene.frame_start = start
    scene.frame_end = end
    scene.render.fps = 30
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output / "frame-")
    bpy.ops.render.render(animation=True)
    print(f"Rendered frames {start}-{end} to {output}")


if __name__ == "__main__":
    main()
