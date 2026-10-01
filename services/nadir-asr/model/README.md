Put the model files here (from https://huggingface.co/Muno459/fastconformer-quran,
after accepting its terms):

- `model.onnx`: from the repo's `onnx/model.onnx`
- `tokenizer.model`: from the repo root
- `demo/` (optional): the repo's demo clips, for `selftest.py`

Optionally run `python quantize.py` to add `model.int8.onnx`, which the server
then uses instead. If you do, move `model.onnx` out of this folder before
deploying, so it isn't built into the image as well.
