#!/usr/bin/env python3
"""Create a non-destructive waving animation from the Teacher Kim test FBX."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector


def require_args() -> tuple[Path, Path, Path]:
    if "--" not in sys.argv:
        raise SystemExit("Usage: blender --background --python script.py -- INPUT OUTPUT PREVIEW_DIR")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) != 3:
        raise SystemExit("Expected INPUT OUTPUT PREVIEW_DIR")
    return Path(args[0]), Path(args[1]), Path(args[2])


def add_world_light() -> None:
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.035, 0.035, 0.045, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55

    for name, location, energy, size in (
        ("Key", (4.0, -5.0, 6.0), 1200.0, 4.0),
        ("Fill", (-4.0, -2.0, 3.5), 800.0, 3.0),
        ("Rim", (1.5, 3.0, 5.0), 900.0, 2.5),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        direction = Vector((0, 0, 2.2)) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def set_camera(meshes: list[bpy.types.Object]) -> bpy.types.Object:
    corners = []
    for obj in meshes:
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    xs = [p.x for p in corners]
    ys = [p.y for p in corners]
    zs = [p.z for p in corners]
    center = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    height = max(zs) - min(zs)

    data = bpy.data.cameras.new("PreviewCamera")
    data.type = "ORTHO"
    data.ortho_scale = height * 1.18
    camera = bpy.data.objects.new("PreviewCamera", data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector((0, -8.0, height * 0.05))
    camera.rotation_euler = (math.radians(90), 0, 0)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera
    return camera


def key_rotation(bone: bpy.types.PoseBone, frame: int, rotation: tuple[float, float, float]) -> None:
    bone.rotation_mode = "XYZ"
    bone.rotation_euler = Euler(tuple(math.radians(value) for value in rotation), "XYZ")
    bone.keyframe_insert("rotation_euler", frame=frame, group=bone.name)


def key_location(bone: bpy.types.PoseBone, frame: int, location: tuple[float, float, float]) -> None:
    bone.location = location
    bone.keyframe_insert("location", frame=frame, group=bone.name)


def add_ik_target(
    armature: bpy.types.Object,
    forearm_name: str,
    target_name: str,
    pole_name: str,
) -> tuple[bpy.types.Object, bpy.types.Object]:
    target = bpy.data.objects.new(target_name, None)
    pole = bpy.data.objects.new(pole_name, None)
    bpy.context.collection.objects.link(target)
    bpy.context.collection.objects.link(pole)
    constraint = armature.pose.bones[forearm_name].constraints.new("IK")
    constraint.name = f"{target_name}_IK"
    constraint.target = target
    constraint.pole_target = pole
    constraint.chain_count = 2
    constraint.use_tail = True
    return target, pole


def key_object_location(obj: bpy.types.Object, frame: int, value: Vector) -> None:
    obj.location = value
    obj.keyframe_insert("location", frame=frame)


def build_wave(armature: bpy.types.Object) -> bpy.types.Action:
    armature.animation_data_clear()
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    for bone in armature.pose.bones:
        bone.matrix_basis.identity()

    action = bpy.data.actions.new("TeacherKim_Wave_Right")
    armature.animation_data_create()
    armature.animation_data.action = action

    # Body stays grounded while subtle torso/head motion keeps the pose alive.
    key_location(armature.pose.bones["root"], 1, (0, 0, 0))
    key_location(armature.pose.bones["root"], 61, (0, 0, 0))
    for frame, spine_z, head_z in ((1, 0, 0), (16, -2, 2), (31, 1, -1), (46, -2, 2), (61, 0, 0)):
        key_rotation(armature.pose.bones["Spine2"], frame, (0, 0, spine_z))
        key_rotation(armature.pose.bones["Head"], frame, (0, 0, head_z))

    # IK targets make the result independent of the FBX's unusual local bone axes.
    left_target, left_pole = add_ik_target(
        armature, "LeftForeArm", "LeftHand_IK_Target", "LeftElbow_Pole"
    )
    right_target, right_pole = add_ik_target(
        armature, "RightForeArm", "RightHand_IK_Target", "RightElbow_Pole"
    )
    left_shoulder = armature.matrix_world @ armature.pose.bones["LeftArm"].head
    right_shoulder = armature.matrix_world @ armature.pose.bones["RightArm"].head
    scale = max((armature.matrix_world @ armature.pose.bones["Head"].head).z, 1.0)
    arm_span = scale * 0.22
    arm_drop = scale * 0.27
    arm_raise = scale * 0.18

    # Non-waving arm hangs naturally beside the torso.
    for frame in (1, 61):
        key_object_location(left_target, frame, left_shoulder + Vector((arm_span, 0.02, -arm_drop)))
        key_object_location(left_pole, frame, left_shoulder + Vector((arm_span * 1.35, -scale * 0.35, -arm_drop * 0.3)))

    # Anatomical right arm appears on the viewer's left. Alternate the wrist target
    # laterally to create a readable wave while the elbow stays lifted beside the head.
    wave_keys = (
        (1, -arm_span, -arm_drop),
        (10, -arm_span * 0.78, arm_raise * 0.78),
        (18, -arm_span * 0.88, arm_raise),
        (26, -arm_span * 0.48, arm_raise * 1.08),
        (34, -arm_span * 0.88, arm_raise),
        (42, -arm_span * 0.48, arm_raise * 1.08),
        (50, -arm_span * 0.68, arm_raise * 0.92),
        (61, -arm_span, -arm_drop),
    )
    for frame, x_offset, z_offset in wave_keys:
        key_object_location(right_target, frame, right_shoulder + Vector((x_offset, 0.02, z_offset)))
        key_object_location(right_pole, frame, right_shoulder + Vector((-arm_span * 1.8, -scale * 0.38, z_offset * 0.18)))
        key_rotation(armature.pose.bones["RightHand"], frame, (0, 0, 0))

    bpy.ops.object.mode_set(mode="OBJECT")
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "BEZIER"
    return action


def render_previews(preview_dir: Path, meshes: list[bpy.types.Object]) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 768
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    add_world_light()
    set_camera(meshes)
    for frame in (1, 10, 18, 26, 34, 42, 50, 61):
        scene.frame_set(frame)
        scene.render.filepath = str(preview_dir / f"wave-{frame:03d}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    input_path, output_path, preview_dir = require_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(input_path))
    armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and len(obj.data.vertices) > 8]
    build_wave(armature)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 61
    scene.render.fps = 30
    render_previews(preview_dir, meshes)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for mesh in meshes:
        mesh.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.fbx(
        filepath=str(output_path),
        use_selection=True,
        bake_anim=True,
        bake_anim_use_all_actions=False,
        bake_anim_use_nla_strips=False,
        bake_anim_simplify_factor=0.0,
        path_mode="COPY",
        embed_textures=True,
        add_leaf_bones=False,
    )
    print(f"Created {output_path}")


if __name__ == "__main__":
    main()
