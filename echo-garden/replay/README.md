# Echo Garden replay (static page)

A self-contained page that replays a recorded gateway session in the browser: the plant's raw
notes, the re-timed notes the sequencer played, a simulated DexArm moving between the six
stations, and the long echo loop's feedback. No server, no CDN, no network calls. It will be
served at `/echo-garden/replay/` (the "Back to Echo Garden" link goes to `../`).

```
index.html  style.css  replay.js
data/demo_session.js    window.SESSION = {...}  (what the page loads by default; works from file://)
data/demo_session.json  the same data as JSON   (for ?session= and the file picker)
```

## Open it locally

Double-click `index.html` (file:// works, because the demo data is a script, not a fetch), or

```bash
cd experiments/scion/docs/echo-garden-site/replay
python3 -m http.server 8000      # then http://localhost:8000/
```

Other sessions: `?session=data/other.json` (served over http only; the name must be a `.json`
path inside this folder), or the file picker / drag and drop onto the page (any origin,
including file://). Sound starts only after "Sound on" is pressed.

## Regenerate the demo data

The demo is the gateway selftest's scenario A: the 2026-08-27 probe (60 s, no contacts) looped
for 300 s on a SimClock with the sim arm, plus an injected duck, clear, body sweep, pick, route
change and panic. The contacts are the sim arm's, so they are synthetic.

```bash
V=~/code/libfreenect2/venv/bin/python
cd experiments/scion/plant
$V -m gateway.run --selftest --log /tmp/gw-demo/events.csv          # keeps scenario A's log
$V -m gateway.export_web /tmp/gw-demo/events.csv \
   -o ../docs/echo-garden-site/replay/data/demo_session.json --js \
   --label "The 2026-08-27 Pocket Scion probe (60 s, no contacts), looped for 5 minutes through the gateway with a simulated arm; gateway selftest scenario A, with a duck, a clear, a scripted body sweep and a panic injected."
```

Any other log works the same way, for example a plain replay run:

```bash
$V -m gateway.run --plant replay --path sessions/2026-08-27-probe --loop --arm sim --dry \
   --sim-clock --minutes 5 --log /tmp/gw-run/events.csv
$V -m gateway.export_web /tmp/gw-run/events.csv -o ../docs/echo-garden-site/replay/data/run.json [--minutes N]
```

`--stations` (default `../scenes/stations_plantarm.json`) gives station names and positions;
`--feed` (default 3000 mm/min) sets the arm-path reconstruction speed; `--js` also writes the
`.js` twin. `python -m gateway.export_web --selftest` checks the exporter. The demo is about
150 KB per file; `sys.*` rows (which hold local paths) are never exported.

The arm path is rebuilt from arm.arrive / touch / lift / park and the station map with the sim
arm's timing model, unless the log's arm events carry a `pos`. The arm is drawn with
approximate DexArm proportions (two 150 mm links, 60 mm head), not measured ones.

## Mounting at /echo-garden/replay/

Copy this folder as is into the Django site's static files (for example
`static/echo-garden/replay/`) and serve `index.html` for `/echo-garden/replay/` (a
`TemplateView`, or let the static server map the directory index). Every path in the page is
relative (`style.css`, `replay.js`, `data/...`, `../`), so it works under any prefix as long
as the URL ends with a slash.
