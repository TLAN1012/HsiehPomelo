#!/usr/bin/env python3
"""用自架的 Qwen-Image「畫室」生成口訣插畫 → css/img/mn/<假名>.webp（320px）。

用法：python3 scripts/gen-mnemonic-images.py [假名…]   不給就畫全部；已存在的檔案跳過。
畫室只在家用 tailnet 內（http://qwen-image:8189），GitHub Actions 不會執行這支。
"""
import io
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'css' / 'img' / 'mn'
API = 'http://qwen-image:8189'
# 注意：生圖模型會把否定句（「不要…」「沒有…」）裡的東西畫出來，所以只用正面描述，
# 而且畫面內容放最前面。有人的場景明寫「人類小朋友」，否則容易畫成擬人的小動物。
STYLE = '。兒童繪本風格的水彩插畫，溫暖柔和的色調，主體置中、構圖簡單，乾淨的淺米色背景。'


def prompt_of(scene):
    return scene.replace('小朋友', '人類小朋友（短髮、穿著T恤）') + STYLE


def api(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def paint(scene):
    j = api('/api/jobs', {'prompt': prompt_of(scene), 'mode': 'turbo', 'size': '1:1'})
    while j['status'] not in ('done', 'error', 'failed'):
        time.sleep(2)
        j = api(f'/api/jobs/{j["id"]}')
    if j['status'] != 'done':
        raise RuntimeError(j.get('error'))
    with urllib.request.urlopen(API + j['image_url'], timeout=120) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB'), j.get('seconds')


def main():
    data = json.loads(subprocess.run(
        ['node', '-e', 'process.stdout.write(JSON.stringify(require("./js/mnemonics.js").DATA))'],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    want = sys.argv[1:] or list(data)
    OUT.mkdir(parents=True, exist_ok=True)
    for kana in want:
        out = OUT / f'{kana}.webp'
        if out.exists():
            continue
        img, secs = paint(data[kana][1])
        img.resize((320, 320), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
        print(f'{kana} {secs}s {out.stat().st_size // 1024}KB  {data[kana][1]}', flush=True)


if __name__ == '__main__':
    main()
