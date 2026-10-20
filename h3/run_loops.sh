#!/bin/bash
# 24 clips: loops for wait/work/sleep, two idle fidgets and a wake-up transition per outfit
cd "$(dirname "$0")"
# the GPU box running ComfyUI + H3, reached over SSH: set these for your own machine
REMOTE=${H3_REMOTE:?set H3_REMOTE=user@host}
PORT=${H3_SSH_PORT:-22}
OUTDIR=${H3_OUTPUT_DIR:-ComfyUI/output/video}
SSHO="-i $HOME/.ssh/id_rsa"
fetch() {  # pull a finished clip that only exists on the server (e.g. the tunnel dropped while waiting)
  mkdir -p out/$1
  scp -q $SSHO -P $PORT "$REMOTE:$OUTDIR/$1_v1_00001_.mp4" out/$1/ 2>/dev/null
}
ensure_tunnel() {  # the local port forward dies now and then; the server keeps running regardless
  curl -s --noproxy '*' -m 8 http://127.0.0.1:8188/queue >/dev/null && return
  ssh -N -f -L 8188:127.0.0.1:8188 $SSHO -p $PORT -o ServerAliveInterval=30 -o ServerAliveCountMax=6 -o ExitOnForwardFailure=yes $REMOTE
  sleep 3
}
run() {  # unit prompt first last
  ensure_tunnel
  if ls out/$1/*.mp4 >/dev/null 2>&1; then echo "skip $1"; return; fi
  fetch $1; if ls out/$1/*.mp4 >/dev/null 2>&1; then echo "DONE $1 (fetched)"; return; fi
  python -u tools/h3_unit.py --unit $1 --tag v1 --mode fl2va --prompt-file $2 --first $3 --last $4 --seconds 3.75 --width 576 --height 960 \
    --clip qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors --wait 2>&1 | grep --line-buffered -E "DONE|ERROR|Error"
}
# don't resubmit a job that is still running from before a restart
while curl -s --noproxy '*' -m 10 http://127.0.0.1:8188/queue | grep -q '"queue_running": \[\['; do sleep 20; done
for t in wait work idleA idleB sleep wakeup; do
  for k in spirit hoodie maid scholar; do
    case $t in
      idleA)  run loop_${k}_$t l_idleA_$k.txt 00_pet_idle_$k.png 00_pet_idle_$k.png ;;
      idleB)  run loop_${k}_$t l_idleB.txt 00_pet_idle_$k.png 00_pet_idle_$k.png ;;
      wakeup) run loop_${k}_$t l_wakeup.txt 00_pet_sleep_$k.png 00_pet_idle_$k.png ;;
      *)      run loop_${k}_$t l_$t.txt 00_pet_${t}_$k.png 00_pet_${t}_$k.png ;;
    esac
  done
done
echo LOOPS_END
