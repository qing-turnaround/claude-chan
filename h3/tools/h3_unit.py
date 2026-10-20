# -*- coding: utf-8 -*-
"""Submit one generation unit to the remote H3 ComfyUI and (optionally) wait + fetch.

ref2va:  python h3_unit.py --unit P2 --mode ref2va --prompt-file units/P2.txt \
           --refs card_warrior.png card_catgirl.png of_orc.png --video P2_S70-71.mp4 \
           --audio P2_S70-71.wav --seconds 7.86 --wait
fl2va:   python h3_unit.py --unit P4 --mode fl2va --prompt-file units/P4.txt \
           --first S13_first.png --last S13_last.png --seconds 5.13 --wait
fetch:   python h3_unit.py --unit P2 --fetch <prompt_id>

All file names are ComfyUI input/ names (scp them first). Output lands in out/<unit>/.
"""
import argparse, json, os, sys, time, urllib.request, urllib.parse

for v in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(v, None)
os.environ["NO_PROXY"] = "127.0.0.1,localhost"
API = "http://127.0.0.1:8188"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS = {
    "ref2va": ("MiniMax-H3-Ref2VA-Pruned-Q5_K_M.gguf",
               "minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"),
    "fl2va":  ("MiniMax-H3-FL2VA-Pruned-Q5_K_M.gguf",
               "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors"),
    # merged fl2va+ref2va weights (W4A8, needs --novram): keyframes + subject refs in ONE ref2va conditioning
    "hybrid": ("minimax_h3_ref2va_hybrid_b20-49_pruned_w4a8_mixed.safetensors",
               "minimax_h3_turbo_v4_step600_ema_pruned_comfyui.safetensors"),
}
CLIP = "qwen3vl_32b_minimax_h3_int4_convrot.safetensors"
VAE_V = "minimax_h3_video_vae_int8_convrot.safetensors"
VAE_A = "minimax_h3_audio_vae_fp32.safetensors"


def snap_frames(seconds):
    n = max(5, round(seconds * 24))
    return n + (5 - n % 17) % 17


def build(a, prompt):
    unet, lora = MODELS[a.mode]
    if a.unet: unet = a.unet
    clip_name = a.clip or CLIP
    g = {
        "u":    ({"class_type": "UNETLoader", "inputs": {"unet_name": unet, "weight_dtype": "default"}} if unet.endswith(".safetensors")
                 else {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": unet}}),
        "sage": {"class_type": "MiniMaxH3MemoryEfficientSageAttentionPatch", "inputs": {"model": ["u", 0]}},
        "lora": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["sage", 0], "lora_name": lora, "strength_model": 1.0}},
        "clip": {"class_type": "CLIPLoader", "inputs": {"clip_name": clip_name, "type": "minimax", "device": "default"}},
        "vae":  {"class_type": "VAELoader", "inputs": {"vae_name": VAE_V}},
        "avae": {"class_type": "VAELoader", "inputs": {"vae_name": VAE_A}},
    }
    if a.loras == "none":
        # bare model, no turbo distillation: needs 20+ steps, used to test whether the glossy look comes from the LoRAs
        g["lora"] = g.pop("sage")
        for k, n in g.items():
            if n["inputs"].get("model") == ["sage", 0]: n["inputs"]["model"] = ["lora", 0]
    elif a.loras:
        # explicit LoRA stack "name:strength,name:strength" chained in order after the sage patch (goldfish: MysticXXX 0.5 -> turbo_v4 1.0)
        prev = ["sage", 0]
        for i, item in enumerate(a.loras.split(",")):
            name, strength = item.rsplit(":", 1)
            g[f"lora{i}"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": prev, "lora_name": name, "strength_model": float(strength)}}
            prev = [f"lora{i}", 0]
        g["lora"] = g.pop(f"lora{i}")
        for k, n in g.items():
            if n["inputs"].get("model") == [f"lora{i}", 0]: n["inputs"]["model"] = ["lora", 0]
    if a.mode in ("ref2va", "hybrid"):
        cond = {"clip": ["clip", 0], "vae": ["vae", 0], "audio_vae": ["avae", 0], "prompt": prompt,
                "width": a.width, "height": a.height, "length": a.frames, "ref_image_size": a.refsize}
        # Autogrow inputs MUST be flat dotted keys in API format ("ref_images.ref_image_0");
        # a nested dict is silently dropped (verified 2026-09-14: two runs with different refs -> identical frames).
        for i, name in enumerate(a.refs):
            g[f"img{i}"] = {"class_type": "LoadImage", "inputs": {"image": name}}
            cond[f"ref_images.ref_image_{i}"] = [f"img{i}", 0]
        if a.video:
            g["vid"] = {"class_type": "VHS_LoadVideo", "inputs": {
                "video": a.video, "force_rate": 24, "custom_width": 0, "custom_height": 0,
                "frame_load_cap": 0, "skip_first_frames": 0, "select_every_nth": 1, "format": a.vformat}}
            cond["ref_videos.ref_video_0"] = ["vid", 0]
        if a.audio:
            g["aud"] = {"class_type": "LoadAudio", "inputs": {"audio": a.audio}}
            cond["ref_audios.ref_audio_0"] = ["aud", 0]
        g["cond"] = {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": cond}
    else:
        cond = {"clip": ["clip", 0], "vae": ["vae", 0], "prompt": prompt,
                "width": a.width, "height": a.height, "length": a.frames}
        if a.first:
            g["f0"] = {"class_type": "LoadImage", "inputs": {"image": a.first}}; cond["first_frame"] = ["f0", 0]
        if a.last:
            g["f1"] = {"class_type": "LoadImage", "inputs": {"image": a.last}}; cond["last_frame"] = ["f1", 0]
        g["cond"] = {"class_type": "MiniMaxH3ImageToVideo", "inputs": cond}

    g.update({
        "guider": {"class_type": "BasicGuider", "inputs": {"model": ["lora", 0], "conditioning": ["cond", 0]}},
        "sched":  {"class_type": "BasicScheduler", "inputs": {"model": ["lora", 0], "scheduler": "beta", "steps": a.steps, "denoise": 1.0}},
        "ks":     {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
        "noise":  {"class_type": "RandomNoise", "inputs": {"noise_seed": a.seed}},
    })
    if a.selflift:
        # SelfLift: run the first `transition_step` steps at `lowres_scale`, lift the latent, finish at full size.
        # Same total NFE as a single pass; our pipeline is guidance-free, so cfg=1 and negative = positive.
        g["sl"] = {"class_type": "SelfLiftH3Sampler", "inputs": {
            "model": ["lora", 0], "positive": ["cond", 0], "negative": ["cond", 0], "vae": ["vae", 0],
            "latent_image": ["cond", 1], "sampler": ["ks", 0], "sigmas": ["sched", 0], "seed": a.seed, "cfg": 1.0,
            "transition_step": a.transition_step, "lowres_scale": a.lowres_scale, "rho": a.rho,
            "w_min": a.w_min, "w_max": a.w_max, "upscaler_model": a.upscaler, "highres_tiling": a.tiling}}
    elif a.twopass:
        # goldfish recipe: one scheduler split into high/low sigmas; pass 1 at base res, latent upscale video only, pass 2 refines
        g["sched"]["inputs"]["steps"] = a.steps + a.refine_steps
        g.update({
            "split": {"class_type": "SplitSigmas", "inputs": {"sigmas": ["sched", 0], "step": a.steps}},
            "samp1": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["noise", 0], "guider": ["guider", 0], "sampler": ["ks", 0], "sigmas": ["split", 0], "latent_image": ["cond", 1]}},
            "sep":   {"class_type": "LTXVSeparateAVLatent", "inputs": {"av_latent": ["samp1", 1]}},
            "up":    {"class_type": "MinimaxH3LatentUpscaler3D", "inputs": {"latent": ["sep", 0], "model_name": "minimax_h3_latent_upscaler_3d_fp16.safetensors",
                      "mode": "scale by multiplier", "mode.scale": a.twopass, "align": 32, "enable_temporal_chunking": True, "force_unload": True, "device": "cuda", "precision": "fp16"}},
            "cat":   {"class_type": "LTXVConcatAVLatent", "inputs": {"video_latent": ["up", 0], "audio_latent": ["sep", 1]}},
            "samp":  {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["noise", 0], "guider": ["guider", 0], "sampler": ["ks", 0], "sigmas": ["split", 1], "latent_image": ["cat", 0]}},
        })
    else:
        g["samp"] = {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["noise", 0], "guider": ["guider", 0], "sampler": ["ks", 0], "sigmas": ["sched", 0], "latent_image": ["cond", 1]}}
    src = ["sl", 0] if a.selflift else ["samp", 1 if a.twopass else 0]
    g.update({
        "dec":    {"class_type": "VAEDecode", "inputs": {"samples": src, "vae": ["vae", 0]}},
        "adec":   {"class_type": "VAEDecodeAudio", "inputs": {"samples": src, "vae": ["avae", 0]}},
        "cv":     {"class_type": "CreateVideo", "inputs": {"images": ["dec", 0], "fps": 24.0, "audio": ["adec", 0]}},
        "sv":     {"class_type": "SaveVideo", "inputs": {"video": ["cv", 0], "filename_prefix": f"video/{a.unit}_{a.tag}", "format": "auto", "codec": "auto"}},
    })
    return g


def http(path, data=None, timeout=120):
    req = urllib.request.Request(API + path, data=data, headers={"Content-Type": "application/json"} if data else {})
    return urllib.request.urlopen(req, timeout=timeout)


def fetch_outputs(pid, outdir):
    h = json.load(http(f"/history/{pid}", timeout=60))
    if pid not in h:
        return None
    ent = h[pid]
    st = ent.get("status", {})
    if st.get("status_str") == "error" or (st.get("completed") is False and st.get("status_str")):
        return {"error": st}
    if not st.get("completed"):
        return None
    files = []
    for node, outs in ent.get("outputs", {}).items():
        for k, v in outs.items():
            if isinstance(v, list):
                for f in v:
                    if isinstance(f, dict) and "filename" in f:
                        q = urllib.parse.urlencode({"filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": f.get("type", "output")})
                        dst = os.path.join(outdir, f["filename"])
                        with open(dst, "wb") as w:
                            w.write(http(f"/view?{q}", timeout=600).read())
                        files.append(dst)
    return {"files": files}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--unit", required=True)
    ap.add_argument("--tag", default="v1")
    ap.add_argument("--mode", choices=["ref2va", "fl2va", "hybrid"], default="ref2va")
    ap.add_argument("--prompt-file")
    ap.add_argument("--refs", nargs="*", default=[])
    ap.add_argument("--video"); ap.add_argument("--vformat", default="H3")
    ap.add_argument("--audio")
    ap.add_argument("--first"); ap.add_argument("--last")
    ap.add_argument("--seconds", type=float)
    ap.add_argument("--frames", type=int)
    ap.add_argument("--width", type=int, default=1344); ap.add_argument("--height", type=int, default=576)
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--twopass", type=float, default=0.0, help="latent upscale factor for goldfish two-pass (e.g. 1.5); 0 = single pass")
    ap.add_argument("--refine-steps", type=int, default=4)
    ap.add_argument("--selflift", action="store_true", help="SelfLift progressive-resolution sampling (facok/comfyui-SelfLift)")
    ap.add_argument("--transition-step", type=int, default=6, help="steps spent at low resolution")
    ap.add_argument("--lowres-scale", type=float, default=0.5)
    ap.add_argument("--rho", type=float, default=0.0, help="0 = learned upscaler route; 0.6 with w 1/1 = SelfLift-zero")
    ap.add_argument("--w-min", type=float, default=0.5)
    ap.add_argument("--w-max", type=float, default=1.0)
    ap.add_argument("--upscaler", default="minimax_h3_latent_upscaler_3d_fp16.safetensors")
    ap.add_argument("--tiling", action="store_true", help="split the high-res phase into tiles to save VRAM")
    ap.add_argument("--unet", help="override UNET file (safetensors -> UNETLoader, gguf -> UnetLoaderGGUF)")
    ap.add_argument("--clip", help="override text encoder file")
    ap.add_argument("--loras", help='LoRA stack "file:strength,file:strength" replacing the mode default')
    ap.add_argument("--seed", type=int, default=20260914)
    ap.add_argument("--refsize", default="match")
    ap.add_argument("--wait", action="store_true")
    ap.add_argument("--fetch", help="prompt_id to poll/fetch instead of submitting")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    outdir = os.path.join(ROOT, "out", a.unit); os.makedirs(outdir, exist_ok=True)
    runlog = os.path.join(outdir, f"run_{a.tag}.json")

    if a.fetch:
        pid, t0 = a.fetch, time.time()
    else:
        if a.frames is None:
            a.frames = snap_frames(a.seconds)
        prompt = open(a.prompt_file, encoding="utf-8").read().strip()
        g = build(a, prompt)
        meta = {"unit": a.unit, "tag": a.tag, "mode": a.mode, "frames": a.frames, "seconds_out": round(a.frames / 24, 3),
                "width": a.width, "height": a.height, "steps": a.steps, "seed": a.seed, "refsize": a.refsize,
                "refs": a.refs, "video": a.video, "audio": a.audio, "first": a.first, "last": a.last,
                "prompt_chars": len(prompt), "submitted": time.strftime("%Y-%m-%d %H:%M:%S")}
        print(json.dumps(meta, ensure_ascii=False))
        if a.dry:
            json.dump(g, open(os.path.join(outdir, f"graph_{a.tag}.json"), "w"), indent=1); print("dry: graph written"); return
        r = json.load(http("/prompt", json.dumps({"prompt": g, "client_id": f"sera-{a.unit}-{a.tag}"}).encode()))
        if r.get("node_errors"):
            print("NODE_ERRORS:", json.dumps(r["node_errors"], ensure_ascii=False)[:2000]); sys.exit(1)
        pid = r["prompt_id"]; meta["prompt_id"] = pid; meta["prompt"] = prompt
        json.dump(meta, open(runlog, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"SUBMITTED {a.unit}/{a.tag} pid={pid}")
        t0 = time.time()
        if not a.wait:
            return

    while True:
        res = fetch_outputs(pid, outdir)
        if res is None:
            q = json.load(http("/queue", timeout=30))
            running = [x[1] for x in q.get("queue_running", [])]
            pending = [x[1] for x in q.get("queue_pending", [])]
            pos = "running" if pid in running else (f"pending#{pending.index(pid)+1}" if pid in pending else "unknown")
            print(f"  {a.unit}/{a.tag} {pos} {int(time.time()-t0)//60}m{int(time.time()-t0)%60:02d}s", flush=True)
            time.sleep(20); continue
        elapsed = round(time.time() - t0, 1)
        if "error" in res:
            print("EXEC_ERROR", json.dumps(res["error"], ensure_ascii=False)[:3000]); sys.exit(2)
        try:
            meta = json.load(open(runlog, encoding="utf-8"))
        except Exception:
            meta = {"unit": a.unit, "tag": a.tag, "prompt_id": pid}
        meta.update({"files": res["files"], "elapsed_s": elapsed, "finished": time.strftime("%Y-%m-%d %H:%M:%S")})
        json.dump(meta, open(runlog, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"DONE {a.unit}/{a.tag} {elapsed/60:.1f} min -> {res['files']}")
        return


if __name__ == "__main__":
    main()
