"""
Video post-processing with ffmpeg:
  * make_preview: downscale + gaussian blur (recognizable but visibly degraded)
  * enhance_final: light unsharp mask + subtle color boost for a crisper HD render

Both keep the original audio, use libx264 fast preset for latency, and run in-memory
via subprocess pipes to avoid touching disk when possible.
"""
import subprocess
import tempfile
import os
import logging

logger = logging.getLogger(__name__)


def _run_ffmpeg(input_bytes: bytes, args_after_input: list[str]) -> bytes:
    """Run ffmpeg on a temp input file (MP4 needs seekable input for moov atom)."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as in_tmp:
        in_tmp.write(input_bytes)
        in_path = in_tmp.name
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as out_tmp:
        out_path = out_tmp.name
    try:
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", in_path, *args_after_input, out_path]
        proc = subprocess.run(cmd, capture_output=True, timeout=180)
        if proc.returncode != 0:
            logger.error(f"ffmpeg failed: {proc.stderr.decode(errors='ignore')[:500]}")
            raise RuntimeError("Post-traitement vidéo échoué")
        with open(out_path, "rb") as f:
            return f.read()
    finally:
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except OSError:
                pass


def make_preview(video_bytes: bytes) -> bytes:
    """Preview: 480p + gaussian blur (sigma=5) — face reconnaissable mais visiblement dégradée."""
    return _run_ffmpeg(
        video_bytes,
        [
            "-vf", "scale=-2:480,gblur=sigma=5",
            "-r", "24",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "30",
            "-c:a", "aac",
            "-b:a", "96k",
            "-movflags", "+faststart",
        ],
    )


def enhance_final(video_bytes: bytes) -> bytes:
    """Final: unsharp mask + eq subtile pour un rendu HD plus net et vivant."""
    return _run_ffmpeg(
        video_bytes,
        [
            "-vf", "unsharp=5:5:0.8:5:5:0.0,eq=contrast=1.05:saturation=1.08",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "20",
            "-c:a", "copy",
            "-movflags", "+faststart",
        ],
    )
