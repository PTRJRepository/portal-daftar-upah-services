import json, pathlib, sys
base = pathlib.Path(sys.argv[1])
f = base / "exploration-dependencies.json"
with open(f, "r", encoding="utf-8") as fh:
    d = json.load(fh)
d["summary"] = "DISABLE_STAGING_DB unreferenced. Config missing field. stagingRoutes unconditional. Startup logging incomplete."
d["mode"] = "dependency-map"
d["status"] = "complete"
with open(f, "w", encoding="utf-8") as fh:
    json.dump(d, fh, indent=2, ensure_ascii=False)
print("OK")
