#!/usr/bin/env python3
"""Extract vanilla 1.21.1 worldgen JSON from a locally supplied Minecraft JAR.

Nothing is downloaded or redistributed by this script. The user supplies the
official JAR from their own installation. Only worldgen JSON and its tags are
copied to the ignored local data/vanilla-1.21.1/ directory.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from typing import Iterable

PREFIXES = (
    "data/minecraft/worldgen/",
    "data/minecraft/tags/worldgen/",
)
MAX_NESTED_DEPTH = 4


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_relevant(path: str) -> bool:
    return path.endswith(".json") and any(path.startswith(prefix) for prefix in PREFIXES)


def iter_archives(blob: bytes, label: str, depth: int = 0) -> Iterable[tuple[str, zipfile.ZipFile]]:
    if depth > MAX_NESTED_DEPTH:
        return
    try:
        archive = zipfile.ZipFile(io.BytesIO(blob))
    except zipfile.BadZipFile:
        return
    yield label, archive
    for name in archive.namelist():
        if not name.lower().endswith(".jar"):
            continue
        try:
            nested = archive.read(name)
        except (KeyError, RuntimeError, zipfile.BadZipFile):
            continue
        yield from iter_archives(nested, f"{label}!/{name}", depth + 1)


def extract(source: Path, output: Path) -> dict:
    source_bytes = source.read_bytes()
    extracted: dict[str, str] = {}
    seen: set[str] = set()
    for archive_label, archive in iter_archives(source_bytes, str(source)):
        try:
            names = archive.namelist()
            for name in names:
                if name in seen or not is_relevant(name):
                    continue
                try:
                    data = archive.read(name)
                    # Validate JSON now, rather than letting broken data fail later in the game.
                    json.loads(data.decode("utf-8"))
                except (KeyError, UnicodeDecodeError, json.JSONDecodeError, RuntimeError) as exc:
                    raise RuntimeError(f"Invalid JSON in {archive_label}!/{name}: {exc}") from exc
                destination = output / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(data)
                extracted[name] = sha256_bytes(data)
                seen.add(name)
        finally:
            archive.close()

    if not extracted:
        raise RuntimeError(
            "No encontré JSON en data/minecraft/worldgen/ dentro del JAR. "
            "Prueba con el JAR oficial del servidor de Minecraft Java 1.21.1."
        )
    manifest = {
        "target": "Minecraft Java Edition 1.21.1",
        "input": str(source.resolve()),
        "inputSha256": sha256_bytes(source_bytes),
        "scope": list(PREFIXES),
        "count": len(extracted),
        "files": extracted,
        "notice": "Local extracted reference data; not committed with the project. Confirm this JAR is vanilla 1.21.1."
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jar", type=Path, help="Ruta al JAR vanilla local de Java 1.21.1")
    parser.add_argument("--output", type=Path, default=Path("data/vanilla-1.21.1"),
                        help="Directorio local de extracción (por defecto: data/vanilla-1.21.1)")
    args = parser.parse_args()
    if not args.jar.is_file():
        print(f"ERROR: no existe el archivo: {args.jar}", file=sys.stderr)
        return 2
    try:
        manifest = extract(args.jar, args.output)
    except (OSError, RuntimeError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"OK: {manifest['count']} JSON de worldgen preparados en {args.output}")
    print("NOTA: extraer los datos no implementa por sí solo el cálculo de densidad ni las reglas vanilla.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
