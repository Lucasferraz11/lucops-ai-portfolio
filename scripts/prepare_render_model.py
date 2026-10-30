"""Build-only demonstration artifact from the public, versioned sample CSV."""

import argparse
import hashlib
import os
from pathlib import Path
from tempfile import TemporaryDirectory

import sklearn

from lucops.ml.artifacts import load_model, save_model
from lucops.ml.features import prepare_csv_features
from lucops.ml.training import train_detector

SAMPLE = Path(__file__).resolve().parents[1] / "data/sample/transacoes.csv"
SAMPLE_SHA256 = "7bc330728c335c15f34bdabfabbb3ae41eca0c1b4915db59e04931db92a1d298"


def build_demo_model(directory: Path) -> Path:
    if sklearn.__version__ != "1.9.1":
        raise ValueError("Render demo requires Scikit-learn 1.9.1.")
    # Git checkouts may use CRLF on Windows and LF on Render/Linux.
    payload = SAMPLE.read_bytes().replace(b"\r\n", b"\n")
    if hashlib.sha256(payload).hexdigest() != SAMPLE_SHA256:
        raise ValueError("Public demo training data differs from the reviewed sample.")
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / "render-isolation-forest.joblib"
    # Rebuilds replace only this build script's own fixed demonstration artifact.
    # No download, user upload or private training data is accepted.
    with TemporaryDirectory(dir=directory) as temporary:
        staged = Path(temporary) / target.name
        save_model(
            train_detector(prepare_csv_features(SAMPLE)),
            staged,
            model_version="iforest-render-demo-v1",
        )
        load_model(staged)
        os.replace(staged, target)
        os.replace(Path(str(staged) + ".json"), Path(str(target) + ".json"))
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("models"))
    print(build_demo_model(parser.parse_args().output_dir))
