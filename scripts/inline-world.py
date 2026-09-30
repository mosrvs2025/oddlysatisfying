#!/usr/bin/env python3
"""Inline world/dist/terrarium.js into swirl-room.html so the page stays a single self-contained file.
Run after `npm run build` in world/."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
js = (root / 'world/dist/terrarium.js').read_text()
assert '</script' not in js.lower()
page = root / 'swirl-room.html'
s = page.read_text()
s, n = re.subn(r'(<script id="terrarium-lib">).*?(</script>)', lambda m: m.group(1) + js.strip() + m.group(2), s, count=1, flags=re.S)
assert n == 1, 'marker not found'
page.write_text(s)
print(f'inlined {len(js)} bytes')
