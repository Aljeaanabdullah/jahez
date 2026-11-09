# Face model (web + mobile, same weights)

**Model:** dlib ResNet face recognition (Davis King), as ported to TensorFlow.js by face-api.js
(`@vladmandic/face-api`, MIT). The author released the weights into the public domain
(<https://github.com/davisking/dlib-models>). It was trained on ~3M faces including the VGG Face
dataset, so the legal review in Phase 12 should confirm its use.

| | Web panel | Mobile app |
|---|---|---|
| Face detection + landmarks | face-api TinyFaceDetector + 68 landmarks | Google ML Kit face detection |
| Alignment to a 150×150 chip | `apps/admin/src/lib/face/align.ts` | `apps/mobile/lib/face/align.dart` |
| Descriptor (128 numbers) | face-api `FaceRecognitionNet` | `assets/models/face_recognition.tflite` |

Both sides align the face with **the same rule** (eye centres + mouth corners only, which both
detectors provide), so the descriptors are comparable. The shared numeric fixtures in
`tools/face-model/align-fixtures.json` are tested on both sides.

## Rebuilding the mobile model

```bash
python -m venv C:\Users\USER\.jahez-tools\venv   # short path: TensorFlow needs it on Windows
C:\Users\USER\.jahez-tools\venv\Scripts\pip install tensorflow-cpu numpy
C:\Users\USER\.jahez-tools\venv\Scripts\python tools/face-model/build_tflite.py
```

`build_tflite.py` rebuilds the network op-for-op from face-api's source, loads
`face_recognition_model.bin`, writes `apps/mobile/assets/models/face_recognition.tflite`, and
writes `out/parity.json`. The browser test `apps/admin/e2e/face-model.spec.ts` then runs face-api
on the same inputs and checks the outputs match.
