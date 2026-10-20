#!/bin/bash
cd "$(dirname "$0")"
for a in cheer eat stretch yawn wave; do
  python -u tools/h3_unit.py --unit pet_$a --tag v1 --mode fl2va --prompt-file $a.txt --first 00_pet_idle.png --last 00_pet_idle.png --seconds 3.75 --width 576 --height 960 --clip qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors --wait 2>&1 | grep -E "SUBMITTED|DONE|ERROR|Error"
done
echo BATCH_END
