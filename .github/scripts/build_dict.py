#!/usr/bin/env python3
"""Build a compact Hancha word index from the open HanjaHanja CSV.

Source: https://github.com/ongocompany/hanjahanja-dict
NIKL Urimalsaem + Standard Korean Language Dictionary derivatives.
License CC BY-SA 2.0 KR. We preserve multiple readings and never assume
that the first homophone is the correct contextual meaning.
"""
import csv
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = "https://raw.githubusercontent.com/ongocompany/hanjahanja-dict/main/data/hanja-words.csv"
out = Path("public")
out.mkdir(exist_ok=True)
request = Request(SOURCE, headers={"User-Agent": "Korea-Lyrics-Translator/1.0"})
with urlopen(request, timeout=90) as resp:
    body = resp.read().decode("utf-8-sig")
reader = csv.DictReader(io.StringIO(body))
words = {}
for row in reader:
    word = (row.get("word") or "").strip()
    hanja = (row.get("hanja") or "").strip()
    if len(word) < 2 or not hanja or not all("\uac00" <= c <= "\ud7a3" for c in word):
        continue
    vals = words.setdefault(word, [])
    if hanja not in vals:
        vals.append(hanja)
if len(words) < 10000:
    raise RuntimeError(f"Dictionary unexpectedly small: {len(words)}")
(out / "hanja-dict.json").write_text(json.dumps(words, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("Built", len(words), "headwords, total homograph spellings:",sum(len(x) for x in words.values()))
