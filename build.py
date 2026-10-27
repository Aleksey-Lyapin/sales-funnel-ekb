"""Fetches the funnel sheets from Google Sheets and builds site/index.html.

Writes `changed=true|false` to $GITHUB_OUTPUT: false when the data and the page
are the same as on the live site, so the workflow can skip the deploy.
"""
import datetime as dt
import hashlib
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request

from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account

SPREADSHEET = "12YedkWCNz3zWORZA5t7f3pjivNq6Z49LeZI1Fuq1cmE"
SITE_URL = "https://aleksey-lyapin.github.io/sales-funnel-ekb/"
# Same ids and ranges as the claude.ai dashboard's datasets.
SOURCES = {
    "f_dnk": "ДНК!A1:LZ60", "f_dmd": "ДМД!A1:LZ60", "f_alisa": "Алиса!A1:LZ60", "f_pif": "ПИФ!A1:LZ60",
    "m_dnk": "ДНК!A85:CZ130", "m_dmd": "ДМД!A85:CZ130", "m_alisa": "Алиса!A85:CZ130", "m_pif": "ПИФ!A85:CZ130",
}

root = pathlib.Path(__file__).parent
key = os.environ.get("GOOGLE_SA_KEY")
creds = (service_account.Credentials.from_service_account_info(json.loads(key)) if key
         else service_account.Credentials.from_service_account_file(os.environ["GOOGLE_SA_FILE"]))
session = AuthorizedSession(creds.with_scopes(["https://www.googleapis.com/auth/spreadsheets.readonly"]))

query = "&".join("ranges=" + urllib.parse.quote(r, safe="") for r in SOURCES.values())
resp = session.get(f"https://sheets.googleapis.com/v4/spreadsheets/{SPREADSHEET}/values:batchGet?{query}", timeout=120)
resp.raise_for_status()
ranges = resp.json()["valueRanges"]
sources = {
    sid: {"args": {"spreadsheetId": SPREADSHEET, "range": rng},
          "answer": {"range": vr.get("range"), "values": vr.get("values", [])}}
    for (sid, rng), vr in zip(SOURCES.items(), ranges)
}

page = (root / "page.html").read_text(encoding="utf-8")
wrapper = (root / "wrapper.html").read_text(encoding="utf-8")
page_hash = hashlib.sha256(page.encode() + wrapper.encode()).hexdigest()
digest = hashlib.sha256(json.dumps(sources, ensure_ascii=False, sort_keys=True).encode()
                        + page.encode() + wrapper.encode()).hexdigest()

try:
    live = urllib.request.urlopen(SITE_URL + "data-hash.txt?t=" + str(int(dt.datetime.now().timestamp())), timeout=30).read().decode().strip()
except Exception as e:  # first deploy or site down
    print("live hash unavailable:", e)
    live = ""
changed = live != digest or os.environ.get("FORCE") == "true"
print("hash", digest, "live", live or "-", "changed", changed)

built = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
data = json.dumps({"builtAt": built, "hash": digest, "pageHash": page_hash, "sources": sources},
                  ensure_ascii=False, separators=(",", ":"))
# The same data is embedded for the first paint and served as data.json for live updates.
html = wrapper.replace("/*__PAGE__*/", page, 1).replace("/*__DATA__*/", data.replace("</", "<\\/"), 1)

site = root / "site"
site.mkdir(exist_ok=True)
(site / "index.html").write_text(html, encoding="utf-8")
(site / "data.json").write_text(data, encoding="utf-8")
(site / "data-hash.txt").write_text(digest, encoding="utf-8")
(site / ".nojekyll").write_text("", encoding="utf-8")
print("site/index.html", len(html.encode()), "bytes")

out = os.environ.get("GITHUB_OUTPUT")
if out:
    with open(out, "a", encoding="utf-8") as f:
        f.write(f"changed={'true' if changed else 'false'}\n")
sys.exit(0)
