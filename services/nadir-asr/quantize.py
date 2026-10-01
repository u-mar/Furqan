"""
Optional: makes an int8 copy of the model (about a quarter of the size, and
usually 2-3x faster on CPU) for a smaller image and quicker cold starts.

    pip install onnx
    python quantize.py

Writes model/model.int8.onnx from model/model.onnx; the server prefers it when
present. Run selftest.py afterwards to check the transcriptions still read
correctly. If they don't, delete model.int8.onnx and the fp32 model is used.
"""

import os

from onnxruntime.quantization import QuantType, quantize_dynamic

SOURCE = os.path.join("model", "model.onnx")
TARGET = os.path.join("model", "model.int8.onnx")

if __name__ == "__main__":
    if not os.path.exists(SOURCE):
        raise SystemExit(f"{SOURCE} not found: download onnx/model.onnx from the model's page first")
    quantize_dynamic(SOURCE, TARGET, weight_type=QuantType.QInt8)
    print(f"Wrote {TARGET} ({os.path.getsize(TARGET) / 1e6:.0f} MB)")
