#!/usr/bin/env bash
# Smoke test for a packaged build: launch it (PET_DEBUG must be set), check that it answers, loads every
# sprite and brings out both Clawds, and save a few window captures to smoke/ for a look by eye.
#   bash scripts/smoke.sh <path to the app's executable> [args...]
set -u
mkdir -p smoke
"$@" > smoke/app.log 2>&1 &
PID=$!
B=http://127.0.0.1:47823
curl() { command curl -s -m 20 "$@"; }   # never hang on one request

for _ in $(seq 1 90); do
  curl -s -m 2 "$B/debug" > smoke/debug.json 2>/dev/null && grep -q '"total"' smoke/debug.json && break
  sleep 1
done
curl -s -X POST -d hoodie "$B/skin" > /dev/null   # start from Claude-chan, whatever the saved outfit
sleep 4
curl -s "$B/debug" > smoke/debug.json
echo "debug: $(cat smoke/debug.json)"

curl -s -o smoke/pet-idle.png "$B/shot"
curl -s -X POST -d work "$B/state" > /dev/null; sleep 3
curl -s -o smoke/pet-work.png "$B/shot"
curl -s -o smoke/settings.png "$B/settings-shot"
curl -s -X POST -d clawd "$B/skin" > /dev/null; sleep 5
curl -s "$B/critters" > smoke/critters.json
curl -s -o smoke/clawd-red.png "$B/critter-shot?red"
curl -s -o smoke/clawd-pink.png "$B/critter-shot?pink"
echo "critters: $(cat smoke/critters.json)"

kill "$PID" 2>/dev/null
sleep 2

node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('smoke/debug.json', 'utf8'));
const c = JSON.parse(fs.readFileSync('smoke/critters.json', 'utf8'));
const shots = fs.readdirSync('smoke').filter((f) => f.endsWith('.png') && fs.statSync('smoke/' + f).size > 1000);
if (d.missing.length || d.total < 500) { console.error('sprites missing', d.missing.slice(0, 10)); process.exit(1); }
if (c.length !== 2) { console.error('expected two Clawds', c); process.exit(1); }
if (shots.length < 5) { console.error('captures came back empty', shots); process.exit(1); }
console.log('smoke ok:', d.total, 'sprites,', c.length, 'Clawds,', shots.length, 'captures');
"
