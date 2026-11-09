"""
Builds the mobile face model from the SAME weights the web panel uses.

The network (dlib ResNet, as ported by face-api.js) is rebuilt op-for-op from
apps/admin/node_modules/@vladmandic/face-api/src/faceRecognitionNet/*.ts, loaded with
face_recognition_model.bin, exported to TFLite, and checked against face-api's own
output in a real browser (apps/admin/e2e/face-model.spec.ts reads out/parity.json).

    python tools/face-model/build_tflite.py

Writes apps/mobile/assets/models/face_recognition.tflite
Input:  [1, 150, 150, 3] float32, RGB pixel values 0..255 (an aligned face crop)
Output: [1, 128] float32 face descriptor
"""
import json
import pathlib
import sys

import numpy as np
import tensorflow as tf

ROOT = pathlib.Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "apps/admin/node_modules/@vladmandic/face-api/model"
OUT_DIR = pathlib.Path(__file__).resolve().parent / "out"
TFLITE = ROOT / "apps/mobile/assets/models/face_recognition.tflite"
TOLERANCE = 1e-4


def load_weights():
    manifest = json.loads((MODEL_DIR / "face_recognition_model-weights_manifest.json").read_text())
    data = (MODEL_DIR / "face_recognition_model.bin").read_bytes()
    weights, offset = {}, 0
    for spec in manifest[0]["weights"]:
        count = int(np.prod(spec["shape"])) if spec["shape"] else 1
        q = spec.get("quantization")
        if q:
            assert q["dtype"] == "uint8"
            raw = np.frombuffer(data, dtype=np.uint8, count=count, offset=offset)
            values = raw.astype(np.float32) * np.float32(q["scale"]) + np.float32(q["min"])
            offset += count
        else:
            values = np.frombuffer(data, dtype=np.float32, count=count, offset=offset).copy()
            offset += count * 4
        weights[spec["name"]] = values.reshape(spec["shape"]).astype(np.float32)
    assert offset == len(data), "unread bytes in the weights file"
    return weights


W = load_weights()


def conv_layer(x, name, strides, relu, padding="SAME"):
    out = tf.nn.conv2d(x, W[f"{name}/conv/filters"], strides=strides, padding=padding)
    out = out + W[f"{name}/conv/bias"]
    out = out * W[f"{name}/scale/weights"] + W[f"{name}/scale/biases"]
    return tf.nn.relu(out) if relu else out


def conv(x, name):
    return conv_layer(x, name, 1, True)


def conv_no_relu(x, name):
    return conv_layer(x, name, 1, False)


def conv_down(x, name):
    return conv_layer(x, name, 2, True, "VALID")


def residual(x, name):
    out = conv(x, f"{name}/conv1")
    out = conv_no_relu(out, f"{name}/conv2")
    return tf.nn.relu(out + x)


def residual_down(x, name):
    out = conv_down(x, f"{name}/conv1")
    out = conv_no_relu(out, f"{name}/conv2")
    pooled = tf.nn.avg_pool2d(x, 2, 2, "VALID")
    # Same shape adjustments as face-api's residualDown.
    if pooled.shape[1] != out.shape[1] or pooled.shape[2] != out.shape[2]:
        out = tf.pad(out, [[0, 0], [0, 1], [0, 0], [0, 0]])
        out = tf.pad(out, [[0, 0], [0, 0], [0, 1], [0, 0]])
    if pooled.shape[3] != out.shape[3]:
        pooled = tf.pad(pooled, [[0, 0], [0, 0], [0, 0], [0, out.shape[3] - pooled.shape[3]]])
    return tf.nn.relu(pooled + out)


@tf.function(input_signature=[tf.TensorSpec([1, 150, 150, 3], tf.float32, name="image")])
def face_descriptor(image):
    x = (image - tf.constant([122.782, 117.001, 104.298], tf.float32)) / 255.0
    out = conv_down(x, "conv32_down")
    out = tf.nn.max_pool2d(out, 3, 2, "VALID")
    for n in ("conv32_1", "conv32_2", "conv32_3"):
        out = residual(out, n)
    out = residual_down(out, "conv64_down")
    for n in ("conv64_1", "conv64_2", "conv64_3"):
        out = residual(out, n)
    out = residual_down(out, "conv128_down")
    for n in ("conv128_1", "conv128_2"):
        out = residual(out, n)
    out = residual_down(out, "conv256_down")
    for n in ("conv256_1", "conv256_2"):
        out = residual(out, n)
    out = residual_down(out, "conv256_down_out")
    pooled = tf.reduce_mean(out, axis=[1, 2])
    return {"descriptor": tf.matmul(pooled, W["fc"])}


def main():
    # Fixed pseudo-random 150x150 images (pixel values 0..255) shared with the browser test.
    rng = np.random.default_rng(12345)
    inputs = rng.integers(0, 256, size=(4, 1, 150, 150, 3)).astype(np.float32)
    graph = np.stack([face_descriptor(tf.constant(i))["descriptor"].numpy()[0] for i in inputs])

    converter = tf.lite.TFLiteConverter.from_concrete_functions(
        [face_descriptor.get_concrete_function()], face_descriptor
    )
    tflite_bytes = converter.convert()
    TFLITE.parent.mkdir(parents=True, exist_ok=True)
    TFLITE.write_bytes(tflite_bytes)

    interpreter = tf.lite.Interpreter(model_content=tflite_bytes)
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()[0]["index"]
    outp = interpreter.get_output_details()[0]["index"]
    lite = []
    for i in inputs:
        interpreter.set_tensor(inp, i)
        interpreter.invoke()
        lite.append(interpreter.get_tensor(outp)[0])
    lite = np.stack(lite)
    diff = float(np.abs(lite - graph).max())
    print(f"TFLite vs TensorFlow rebuild: max difference {diff:.2e}")
    print(f"wrote {TFLITE.relative_to(ROOT)} ({len(tflite_bytes) / 1e6:.1f} MB)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "parity.json").write_text(json.dumps({
        "inputs": [i.reshape(-1).astype(int).tolist() for i in inputs],
        "descriptors": lite.tolist(),
    }))
    print(f"wrote {(OUT_DIR / 'parity.json').relative_to(ROOT)} for the browser parity test")

    if diff > TOLERANCE:
        print(f"FAILED: difference above {TOLERANCE}")
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
