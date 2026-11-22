#!/usr/bin/env python3
"""Evaluate three Korean→Traditional Chinese token alignment providers."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
PROVIDERS = ("gemini", "gemini-lexialign", "simalign")
SCHEMA = {"type": "OBJECT", "properties": {"edges": {"type": "ARRAY", "items": {
    "type": "OBJECT", "properties": {"source": {"type": "INTEGER"}, "target": {"type": "INTEGER"}},
    "required": ["source", "target"]}}}, "required": ["edges"]}


def edges(raw, case, strict=True):
    if not isinstance(raw, list):
        raise ValueError("Edges must be a list")
    out = set()
    for item in raw:
        if isinstance(item, dict):
            item = [item.get("source"), item.get("target")]
        if not (isinstance(item, (list, tuple)) and len(item) == 2
                and all(type(v) is int for v in item)
                and 0 <= item[0] < len(case["source"])
                and 0 <= item[1] < len(case["target"])):
            raise ValueError("Invalid alignment edge: " + repr(item)[:80])
        pair = tuple(item)
        if strict and pair in out:
            raise ValueError("Duplicate edge")
        out.add(pair)
    return out


def load_dataset(path):
    raw = Path(path).read_bytes()
    data = json.loads(raw)
    if data.get("version") != 1 or data.get("language_pair") != "ko-zh-Hant":
        raise ValueError("Unsupported data format")
    cases = data.get("cases")
    if not isinstance(cases, list) or not cases:
        raise ValueError("No benchmark cases")
    seen = set()
    for case in cases:
        if not isinstance(case.get("id"), str) or not case["id"] or case["id"] in seen:
            raise ValueError("Duplicate or empty case ID")
        seen.add(case["id"])
        for key in ("source", "target"):
            tokens = case.get(key)
            if not isinstance(tokens, list) or not tokens or any(not isinstance(t, str) or not t.strip() for t in tokens):
                raise ValueError("Missing or invalid tokens")
        sure, possible = edges(case.get("sure"), case), edges(case.get("possible"), case)
        if sure & possible:
            raise ValueError("Sure and possible gold edges overlap")
    return data, hashlib.sha256(raw).hexdigest()


def score(case, predicted):
    sure = edges(case["sure"], case)
    possible = sure | edges(case["possible"], case)
    correct_s = len(predicted & sure)
    correct_p = len(predicted & possible)
    p = correct_p / len(predicted) if predicted else 0.
    r = correct_s / len(sure) if sure else 1.
    f1 = 2*p*r/(p+r) if p+r else 0.
    aer = 1-(correct_s+correct_p)/(len(predicted)+len(sure)) if predicted or sure else 0.
    return {"precision":p,"recall":r,"f1":f1,"aer":aer,"correct_sure":correct_s,
            "correct_possible":correct_p,"predicted":len(predicted),"gold_sure":len(sure),
            "source_coverage":len({i for i,j in predicted})/len(case["source"]),
            "target_coverage":len({j for i,j in predicted})/len(case["target"])}


def summary(rows):
    n = len(rows)
    total = lambda key: sum(row["metrics"][key] for row in rows)
    predicted, gold = total("predicted"), total("gold_sure")
    ps, pp = total("correct_sure"), total("correct_possible")
    precision = pp/predicted if predicted else 0.
    recall = ps/gold if gold else 1.
    f1 = 2*precision*recall/(precision+recall) if precision+recall else 0.
    return {"attempted":n,"succeeded":sum(row["status"]=="ok" for row in rows),
            "failed":sum(row["status"]!="ok" for row in rows),
            "precision":precision,"recall":recall,"micro_f1":f1,
            "macro_f1":sum(row["metrics"]["f1"] for row in rows)/n if n else 0,
            "aer":1-(ps+pp)/(predicted+gold) if predicted+gold else 0,
            "source_coverage":sum(row["metrics"]["source_coverage"] for row in rows)/n if n else 0,
            "target_coverage":sum(row["metrics"]["target_coverage"] for row in rows)/n if n else 0,
            "seconds":round(sum(row["seconds"] for row in rows),3)}


def gemini(case, model, timeout):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not configured")
    prompt = ("Align the given Korean source tokens to existing Traditional Chinese target tokens "
              "using semantics, not homophonic Hanja. Do not translate, change or invent tokens. "
              "Return only zero-based edges; permit many-to-many or unaligned tokens. "
              "You have no access to gold labels.\n"
              +json.dumps({"source":case["source"],"target":case["target"]},ensure_ascii=False))
    body = {"contents":[{"role":"user","parts":[{"text":prompt}]}],
            "generationConfig":{"temperature":0,"responseMimeType":"application/json","responseSchema":SCHEMA}}
    # Key is not put in URL or any report.
    request = Request("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",
        data=json.dumps(body).encode(),headers={"Content-Type":"application/json","x-goog-api-key":key},method="POST")
    try:
        with urlopen(request,timeout=timeout) as response:
            response_data=json.load(response)
    except HTTPError as exc:
        raise RuntimeError("Gemini HTTP "+str(exc.code)) from None
    except URLError:
        raise RuntimeError("Gemini connection failed") from None
    try:
        content = "".join(part.get("text","") for c in response_data["candidates"]
                          for part in c["content"]["parts"])
        return json.loads(content)["edges"]
    except (KeyError, ValueError, TypeError) as exc:
        raise ValueError("Gemini structured response was invalid") from exc


def lexialign(case, model):
    try:
        from lexi_align import align_tokens, create_adapter
        from lexi_align.utils import make_unique
    except ImportError as exc:
        raise RuntimeError("Install requirements-lexialign.txt") from exc
    if not os.getenv("GEMINI_API_KEY"):
        raise RuntimeError("GEMINI_API_KEY not configured")
    adapter = create_adapter("litellm:gemini/"+model, temperature=0)
    result = align_tokens(adapter,case["source"],case["target"],
                          source_language="Korean",target_language="Traditional Chinese")
    if result.alignment is None:
        raise RuntimeError("LexiAlign returned no valid alignment")
    # LexiAlign disambiguates repeated words by Unicode subscripts.
    src = {word:i for i,word in enumerate(make_unique(case["source"]))}
    tgt = {word:i for i,word in enumerate(make_unique(case["target"]))}
    out = []
    for item in result.alignment.alignment:
        if item.source not in src or item.target not in tgt:
            raise ValueError("LexiAlign returned an unknown token")
        out.append([src[item.source],tgt[item.target]])
    return out


_SIM_ALIGNER = None
def simalign(case, model):
    global _SIM_ALIGNER
    if _SIM_ALIGNER is None:
        try:
            from simalign import SentenceAligner
        except ImportError as exc:
            raise RuntimeError("Install requirements-simalign.txt") from exc
        _SIM_ALIGNER = SentenceAligner(model=model,token_type="bpe",matching_methods="mai")
    return list(_SIM_ALIGNER.get_word_aligns(case["source"],case["target"])["itermax"])


def dispatch(provider,case,model,sim_model,timeout):
    if provider=="gemini":
        return gemini(case,model,timeout)
    if provider=="gemini-lexialign":
        return lexialign(case,model)
    if provider=="simalign":
        return simalign(case,sim_model)
    raise ValueError("Unsupported provider")


def run(data,provider,model,sim_model,timeout=60,delay=3):
    rows=[]
    for case in data["cases"]:
        started=time.monotonic()
        try:
            predicted=edges(dispatch(provider,case,model,sim_model,timeout),case,strict=False)
            status="ok"
            error=None
        except Exception as exc:
            predicted=set()
            status="failed"
            error=type(exc).__name__+": "+str(exc)[:140]
        rows.append({"id":case["id"],"status":status,"error":error,
                     "edges":[list(x) for x in sorted(predicted)],
                     "metrics":score(case,predicted),"seconds":round(time.monotonic()-started,3)})
        print(provider,case["id"],status,file=sys.stderr)
        if provider!="simalign" and delay:
            time.sleep(delay)
    return {"provider":provider,"model":sim_model if provider=="simalign" else model,
            "summary":summary(rows),"cases":rows}


def markdown(report):
    lines=["# Ko→zh-Hant alignment comparison","","Dataset SHA256: "+report["dataset_sha256"],"",
           "| Provider | Cases | Failed | Precision | Recall | F1 | AER | Macro F1 |",
           "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in report["results"]:
        s=r["summary"]
        lines.append("| {provider} | {attempted} | {failed} | {precision:.3f} | {recall:.3f} | {micro_f1:.3f} | {aer:.3f} | {macro_f1:.3f} |".format(provider=r["provider"],**s))
    lines+=["","Failed cases are included as empty predictions, never excluded.",
            "These figures evaluate alignment only, not translation or Hanja accuracy.",""]
    return "\n".join(lines)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset",default=str(ROOT/"dataset.json"))
    parser.add_argument("--provider",choices=(*PROVIDERS,"all"))
    parser.add_argument("--model",default=os.getenv("GEMINI_MODEL","gemini-2.5-flash"))
    parser.add_argument("--sim-model",default=os.getenv("SIMALIGN_MODEL","bert"))
    parser.add_argument("--timeout",type=int,default=60)
    parser.add_argument("--delay",type=float,default=3)
    parser.add_argument("--output")
    parser.add_argument("--validate-only",action="store_true")
    args=parser.parse_args()
    data,checksum=load_dataset(args.dataset)
    if args.validate_only:
        print(json.dumps({"cases":len(data["cases"]),"sha256":checksum}))
        return 0
    if not args.provider:
        parser.error("Select --provider or --validate-only")
    providers=PROVIDERS if args.provider=="all" else (args.provider,)
    report={"version":1,"kind":"live","dataset_sha256":checksum,
            "language_pair":data["language_pair"],"results":[]}
    for provider in providers:
        report["results"].append(run(data,provider,args.model,args.sim_model,args.timeout,args.delay))
    print(markdown(report))
    if args.output:
        out=Path(args.output)
        out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        out.with_suffix(".md").write_text(markdown(report),encoding="utf-8")
    return int(any(item["summary"]["failed"] for item in report["results"]))


if __name__=="__main__":
    raise SystemExit(main())
