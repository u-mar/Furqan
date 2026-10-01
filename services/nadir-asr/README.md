# nadir-asr

Nadir's speech service. Send it a recitation; it returns the words recited
and when each word starts and ends. It runs
[Muno459/fastconformer-quran](https://huggingface.co/Muno459/fastconformer-quran)
on CPU, on Google Cloud Run.

```
GET  /            → {"ok": true}  when the model is loaded
POST /transcribe  → multipart form with an "audio" file (WebM, M4A, MP3, WAV…)
                    header x-api-key: <ASR_API_KEY>
```

Reply:

```json
{
  "text": "قل هو الله احد",
  "words": [{ "word": "قل", "start": 0.48, "end": 0.8 }, …],
  "durationSec": 4.2,
  "confidence": 0.93,
  "elapsedMs": 640
}
```

Matching the words to ayat happens in the Nadir app's server, which has the
Quran text. This service only listens.

**Licence:** the model is NPL-1.1 (no profit of any kind may be made from it),
and its base model is NVIDIA's (CC-BY 4.0, which needs an NVIDIA credit in the app).

---

## 1. Get the model

1. Open https://huggingface.co/Muno459/fastconformer-quran, sign in, and accept the terms.
2. Download into `model/`:
   - `onnx/model.onnx` → save as `model/model.onnx`
   - `tokenizer.model` → `model/tokenizer.model`
   - the `demo/` folder → `model/demo/` (for the check in step 2)

## 2. Check it on your computer (recommended)

You need Python 3.11.

```bash
python -m venv .venv
```

```bash
.venv\Scripts\activate
```

```bash
pip install -r requirements.txt
```

```bash
python selftest.py model/demo
```

The self-test tries the three audio-processing settings that differ between
toolkits, and prints the ones the model is most confident with, plus each
demo clip's text. The texts should read as Q 1:4, 112:1 and 38:67. If the
winning settings aren't the defaults (`periodic`, `reflect`,
`per_feature`), change the three `FEATURE_…` lines in the `Dockerfile`.

**Optional, faster and smaller:** `pip install onnx`, then `python quantize.py`
makes `model/model.int8.onnx`. Run the self-test again. If the texts still read
correctly, move `model/model.onnx` out of the folder, so only the int8 copy goes
into the image.

To try the server itself:

```bash
uvicorn app:app --port 8080
```

## 3. Deploy to Cloud Run

Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), then:

```bash
gcloud auth login
```

```bash
gcloud config set project YOUR-PROJECT-ID
```

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Make a secret key. Nadir's server sends it with every request, and the service
refuses anything without it:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

From this folder, with your key in place of `YOUR-KEY`:

```bash
gcloud run deploy nadir-asr --source . --region europe-west1 --memory 2Gi --cpu 2 --concurrency 2 --min-instances 0 --max-instances 2 --timeout 300 --cpu-boost --execution-environment gen2 --allow-unauthenticated --set-env-vars ASR_API_KEY=YOUR-KEY
```

Google builds the image from the `Dockerfile` (no Docker needed on your
computer) and prints the service URL at the end.

- **Why "allow unauthenticated"?** Google's own sign-in for Cloud Run needs
  service-account keys on the Nadir server. The secret key does the same job
  more simply: without it, the service answers 401 and does no work.
- **Region:** pick one near your users and your MongoDB database. It can't be
  changed later.
- **Cost:** with minimum instances 0 it sleeps when unused. Request-based
  billing (the default) is what the monthly free allowance covers. Set a
  budget alert in Billing.

## 4. Check it

```bash
curl https://YOUR-SERVICE-URL/
```

```bash
curl -H "x-api-key: YOUR-KEY" -F "audio=@model/demo/YOUR-CLIP.wav" https://YOUR-SERVICE-URL/transcribe
```

The first request after a pause takes a few extra seconds while it wakes up.

## 5. Connect Nadir

Add to the Nadir app's hosting environment:

- `ASR_URL` = the service URL
- `ASR_API_KEY` = the same key

Wiring Qari uploads to it (sending recordings during "Finishing up…" and
saving the ayat and word timings) is the next step in the app.

## Settings

| Variable | Default | |
|---|---|---|
| `ASR_API_KEY` | not set | When set, required as the `x-api-key` header |
| `MODEL_DIR` | `./model` | Uses `model.int8.onnx`, else `model.onnx`, else `model.fp16.onnx` |
| `MODEL_PATH`, `TOKENIZER_PATH` | | Point at exact files instead |
| `ORT_THREADS` | all CPUs | Threads for the model |
| `FEATURE_WINDOW` | `periodic` | `periodic` or `symmetric` |
| `FEATURE_PAD` | `reflect` | `reflect` or `constant` |
| `FEATURE_NORMALIZE` | `per_feature` | `per_feature` or `none` |

Recordings longer than 40 seconds are cut at the quietest moment between 25
and 40 seconds (reciters pause between ayat), so memory use stays flat. The
limits are 30 MB and 15 minutes per recording.
