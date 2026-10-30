import importlib.util
from pathlib import Path

import numpy as np

from lucops.ml.artifacts import load_model

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare_render_model.py"


def test_render_build_creates_and_rebuilds_a_trusted_reproducible_model(
    tmp_path, monkeypatch
):
    spec = importlib.util.spec_from_file_location("render_model", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    payload = module.SAMPLE.read_bytes().replace(b"\r\n", b"\n")
    sample = tmp_path / "sample.csv"
    sample.write_bytes(payload)
    monkeypatch.setattr(module, "SAMPLE", sample)
    target = module.build_demo_model(tmp_path)
    first, metadata = load_model(target)
    scores = first.decision_function([[10], [100], [1000000]])
    sample.write_bytes(payload.replace(b"\n", b"\r\n"))
    module.build_demo_model(tmp_path)
    rebuilt, repeated = load_model(target)
    assert metadata == repeated
    assert metadata["sklearn_version"] == "1.9.1"
    assert metadata["training_records"] == 8
    assert metadata["model_version"] == "iforest-render-demo-v1"
    np.testing.assert_array_equal(
        scores, rebuilt.decision_function([[10], [100], [1000000]])
    )
