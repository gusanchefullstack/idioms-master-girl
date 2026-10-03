"""Create tests/fixtures/clip.webm: macOS `say` → libopus/webm, like Chrome's MediaRecorder."""

import pathlib
import subprocess
import tempfile

import av

TEXT = "Finishing the homework was a piece of cake for me."
OUT = pathlib.Path(__file__).parent / "fixtures" / "clip.webm"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        aiff = pathlib.Path(tmp) / "clip.aiff"
        subprocess.run(["say", "-v", "Samantha", "-o", str(aiff), TEXT], check=True)
        src = av.open(str(aiff))
        dst = av.open(str(OUT), "w", format="webm")
        stream = dst.add_stream("libopus", rate=48000)
        for frame in src.decode(audio=0):
            frame.pts = None
            for packet in stream.encode(frame):
                dst.mux(packet)
        for packet in stream.encode(None):
            dst.mux(packet)
        dst.close()
        src.close()
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
