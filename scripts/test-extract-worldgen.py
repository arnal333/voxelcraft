#!/usr/bin/env python3
"""Offline smoke test for extracting worldgen JSON from nested JAR archives."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "extract-worldgen-data.py"


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="voxelcraft-worldgen-test-") as temp:
        base = Path(temp)
        nested = base / "server-1.21.1.jar"
        inner_json = b'{"test": true, "version": "1.21.1"}'
        with zipfile.ZipFile(nested, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(
                "data/minecraft/worldgen/noise_settings/overworld.json",
                inner_json,
            )
            archive.writestr(
                "data/minecraft/tags/worldgen/biome/is_overworld.json",
                b'{"replace": false, "values": []}',
            )
            archive.writestr("data/minecraft/block/test.json", b'{"ignored": true}')

        bundled = base / "server-bundle.jar"
        with zipfile.ZipFile(bundled, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("META-INF/versions/1.21.1/server-1.21.1.jar", nested.read_bytes())

        output = base / "out"
        result = subprocess.run(
            [sys.executable, str(SCRIPT), str(bundled), "--output", str(output)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise AssertionError(f"Extractor failed ({result.returncode}): {result.stdout}\n{result.stderr}")

        extracted = output / "data/minecraft/worldgen/noise_settings/overworld.json"
        tag_file = output / "data/minecraft/tags/worldgen/biome/is_overworld.json"
        ignored = output / "data/minecraft/block/test.json"
        manifest_path = output / "manifest.json"
        assert extracted.read_bytes() == inner_json
        assert tag_file.is_file()
        assert not ignored.exists()
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest["count"] == 2, manifest
        assert manifest["files"]["data/minecraft/worldgen/noise_settings/overworld.json"] == hashlib.sha256(inner_json).hexdigest()
        print("PASS  extractor reads nested server JARs, validates JSON and writes a hash manifest.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
