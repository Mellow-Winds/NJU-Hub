"""
collect.py — 批量采集南大验证码样本

用法:
    python collect.py --count 500 --output ./samples

说明:
    南大验证码 URL: https://authserver.nju.edu.cn/authserver/captcha
    每次请求返回一张新的 80x30 PNG 验证码图片
    采集后保存为 samples/captcha_0001.png ... captcha_0500.png
"""

import os
import time
import argparse
import requests
from PIL import Image
from io import BytesIO

CAPTCHA_URL = "https://authserver.nju.edu.cn/authserver/getCaptcha.htl"


def collect(count: int, output_dir: str, delay: float = 0.3):
    os.makedirs(output_dir, exist_ok=True)
    
    # 找到已有最大编号，继续递增
    existing = [f for f in os.listdir(output_dir) if f.startswith("captcha_")]
    start_idx = len(existing)
    
    print(f"开始采集: 目标 {count} 张, 起始编号 {start_idx + 1}")
    
    success = 0
    fail = 0
    for i in range(count):
        idx = start_idx + i + 1
        for retry in range(3):  # 最多重试3次
            try:
                resp = requests.get(CAPTCHA_URL, timeout=10)
                if resp.status_code != 200:
                    if retry < 2:
                        time.sleep(delay * 3)
                        continue
                    print(f"  [{idx}] HTTP {resp.status_code}, 跳过")
                    break
                
                img = Image.open(BytesIO(resp.content))
                # 统一转为 PNG 保存
                filename = f"captcha_{idx:04d}.png"
                img.save(os.path.join(output_dir, filename))
                success += 1
                
                if success % 50 == 0:
                    print(f"  已采集 {success}/{count}")
                
                time.sleep(delay)
                break
                
            except Exception as e:
                if retry < 2:
                    time.sleep(delay * 3)
                    continue
                print(f"  [{idx}] 错误: {e}")
                fail += 1
    
    print(f"\n采集完成: 成功 {success}/{count} 张, 失败 {fail} 张, 保存到 {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="采集南大验证码样本")
    parser.add_argument("--count", type=int, default=500, help="采集数量")
    parser.add_argument("--output", type=str, default="./samples", help="输出目录")
    parser.add_argument("--delay", type=float, default=0.3, help="每次请求间隔(秒)")
    args = parser.parse_args()
    
    collect(args.count, args.output, args.delay)
