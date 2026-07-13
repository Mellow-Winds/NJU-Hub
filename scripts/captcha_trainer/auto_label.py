"""
auto_label.py — 自动标注验证码样本

策略:
    1. 用 ddddocr (common_old.onnx) 识别每张图片
    2. 用 ddddocr (common.onnx 新版) 再识别一次
    3. 两个模型结果一致 → 高置信标注
    4. 不一致 → 用 old 模型结果（仍然标注，只是标记为低置信）
    所有结果都写入 labels.json，低置信的额外记录到 manual_review.txt

用法:
    python auto_label.py --samples ./samples --output labels.json

输出:
    labels.json: {"captcha_0001.png": "aB3x", ...}
    manual_review.txt: 低置信度标注列表
"""

import os
import json
import argparse
import ddddocr


def auto_label(samples_dir: str, output_file: str):
    print("加载 ddddocr 旧版模型...")
    ocr_old = ddddocr.DdddOcr(show_ad=False, old=True)

    print("加载 ddddocr 新版模型 (beta)...")
    try:
        ocr_new = ddddocr.DdddOcr(show_ad=False, beta=True)
    except Exception:
        print("新版模型加载失败，仅使用旧版模型")
        ocr_new = None

    files = sorted([f for f in os.listdir(samples_dir) if f.endswith(".png")])
    print(f"\n共 {len(files)} 张样本待标注")

    labels = {}
    need_review = []

    for i, filename in enumerate(files):
        filepath = os.path.join(samples_dir, filename)
        with open(filepath, "rb") as f:
            img_bytes = f.read()

        result_old = ocr_old.classification(img_bytes)

        if ocr_new:
            result_new = ocr_new.classification(img_bytes)
        else:
            result_new = result_old

        # 只接受4位长度的结果
        if len(result_old) != 4:
            # old 模型结果不是4位，跳过
            need_review.append({
                "file": filename,
                "old_model": result_old,
                "new_model": result_new
            })
        else:
            # old 模型结果是4位，直接标注
            labels[filename] = result_old
            # 如果两个模型不一致，标记为低置信
            if result_old != result_new:
                need_review.append({
                    "file": filename,
                    "old_model": result_old,
                    "new_model": result_new
                })

        if (i + 1) % 200 == 0:
            print(f"  进度: {i+1}/{len(files)}, 已标注: {len(labels)}, 低置信: {len(need_review)}")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)

    review_file = os.path.join(os.path.dirname(output_file), "manual_review.txt")
    with open(review_file, "w", encoding="utf-8") as f:
        for item in need_review:
            f.write(f"{item['file']}\t旧:{item['old_model']}\t新:{item['new_model']}\n")

    print(f"\n标注完成:")
    print(f"  已标注: {len(labels)} 张 → {output_file}")
    print(f"  低置信: {len(need_review)} 张 → {review_file}")
    print(f"  标注率: {len(labels)/len(files)*100:.1f}%")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="自动标注验证码样本")
    parser.add_argument("--samples", type=str, default="./samples", help="样本目录")
    parser.add_argument("--output", type=str, default="labels.json", help="输出标注文件")
    args = parser.parse_args()

    auto_label(args.samples, args.output)
