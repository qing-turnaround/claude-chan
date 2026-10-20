#!/bin/bash
cd "$(dirname "$0")"
for k in maid scholar spirit; do
  for a in happy cheer wave eat stretch yawn; do
    if ls out/pet_${k}_$a/*.mp4 >/dev/null 2>&1; then echo "skip $k/$a"; continue; fi
    python -u tools/h3_unit.py --unit pet_${k}_$a --tag v1 --mode fl2va --prompt-file g_$a.txt --first 00_pet_idle_$k.png --last 00_pet_idle_$k.png --seconds 3.75 --width 576 --height 960 --clip qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors --wait 2>&1 | grep --line-buffered -E "DONE|ERROR|Error"
  done
done
echo SKINS_BATCH_END
