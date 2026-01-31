import json
from pathlib import Path

class Queries:
    def __init__(self):
        self._cache = {}

    def _group_path(self, group: str) -> Path:
        base = Path(__file__).resolve().parents[1]
        return base / 'queries' / f'{group}.json'

    def _load_group(self, group: str):
        if group in self._cache:
            return self._cache[group]
        p = self._group_path(group)
        with p.open('r', encoding='utf-8') as f:
            data = json.load(f)
        self._cache[group] = data
        return data

    def get(self, group: str, name: str):
        data = self._load_group(group)
        return data.get(name)
