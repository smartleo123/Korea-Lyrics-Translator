# Korean → Traditional Chinese alignment A/B benchmark

Benchmark of **Gemini structured JSON**, **Gemini + LexiAlign**, and **local SimAlign** using *identical pre-tokenized Korean and Traditional Chinese sentences*. This is not a replacement translation service. The existing GitHub Pages app is unchanged.

## Dataset

- benchmark/dataset.json is versioned, includes original educational examples only, and has manually created toy gold alignment edges.
- Source/target are arrays of word or phrase units. sure and possible hold zero-based [sourceIndex,targetIndex] pairs. Possible edges are optional valid matches that do not count toward recall.
- schema.json describes the JSON format. All provider prompts exclude gold edges. Keep gold separate from generated predictions.
- Eight examples validate the pipeline; they **cannot prove which real model is best**. Expand with consented/licensed independently reviewed Korean↔Traditional Chinese examples before making accuracy claims.

## Metrics and fairness

Precision = predicted edges intersect (sure + possible) / predicted edges. Recall = predicted intersect sure / sure. F1 is harmonic mean. AER = 1 - ((predicted ∩ sure) + (predicted ∩ possible)) / (predicted count + sure count). Report micro and macro F1, source/target token coverage, elapsed time and failure count. Failed cases count as empty alignments, not as skipped cases. Dataset SHA256 accompanies results.

All arms receive the identical Chinese reference, not separately translated outputs. This tests **alignment conditional on translation**, not translation adequacy or correctness of Sino-Korean etymology. No song-specific rules appear in adapters.

## CI: free and offline

From repository root run:

    python3 -m unittest discover -s benchmark -p 'test_*.py' -v
    python3 benchmark/runner.py --validate-only

These are deterministic *contract tests* using a mocked adapter, **not mock model rankings**. alignment-benchmark.yml runs them on push/PR with no API credentials, downloads or fees.

## Optional real model runs

Use Python 3.11+, choose your Gemini model according to current Google free quota and availability; not all models/tier combinations are free. Store GEMINI_API_KEY in the shell environment (never commit it, or put it in frontend JavaScript).

    export GEMINI_API_KEY=YOUR_PRIVATE_KEY
    python3 benchmark/runner.py --provider gemini --output benchmark/results/gemini.json

For LexiAlign (uses LiteLLM with the exact same Gemini model; may consume API quota):

    pip install -r benchmark/requirements-lexialign.txt
    python3 benchmark/runner.py --provider gemini-lexialign --output benchmark/results/lexialign.json

For SimAlign (free to run locally, but downloads heavy PyTorch and pretrained model weights):

    pip install -r benchmark/requirements-simalign.txt
    python3 benchmark/runner.py --provider simalign --sim-model bert --output benchmark/results/simalign.json

For a full local comparison after installing both optional dependency groups:

    python3 benchmark/runner.py --provider all --output benchmark/results/all.json

Output writes JSON and a Markdown summary. Use --model, --sim-model, --delay and --timeout to record consistent conditions. Model randomness, service revisions, API quotas, CPU/GPU, and pretrained weights can influence real repeatability. Record model versions and rerun trials before product conclusions.

The opt-in GitHub Actions workflow_dispatch runs **live Gemini only** when explicitly selected and GEMINI_API_KEY exists as repository secret. CI never silently spends quota. Install LexiAlign and SimAlign locally for full A/B; their optional dependencies are deliberately excluded from the standard Pages deploy.

Repositories: https://github.com/borh-lab/lexi-align and https://github.com/cisnlp/simalign . Official Gemini API documentation: https://ai.google.dev/gemini-api/docs .
