"""
manual_label.py — 人工校对工具

用法:
    python manual_label.py --samples ./samples --labels labels.json

功能:
    1. 读取 auto_label.py 生成的 manual_review.txt
    2. 逐张显示图片，显示 ddddocr 的两个结果
    3. 用户输入正确标签（直接回车=选旧模型，输入n=选新模型，输入文本=自定义）
    4. 更新 labels.json
"""

import os
import json
import argparse
from PIL import Image


def manual_label(samples_dir, labels_file):
    # 加载已有标签
    with open(labels_file, "r", encoding="utf-8") as f:
        labels = json.load(f)
    
    review_file = os.path.join(os.path.dirname(labels_file) or ".", "manual_review.txt")
    if not os.path.exists(review_file):
        print("未找到 manual_review.txt，请先运行 auto_label.py")
        return
    
    with open(review_file, "r", encoding="utf-8") as f:
        review_items = [line.strip().split("\t") for line in f if line.strip()]
    
    print(f"共 {len(review_items)} 张待校对")
    print("操作: 直接回车=旧模型结果, n=新模型结果, 输入文本=自定义\n")
    
    corrected = 0
    for item in review_items:
        filename = item[0]
        old_result = item[1].split(":")[1]
        new_result = item[2].split(":")[1]
        
        filepath = os.path.join(samples_dir, filename)
        if not os.path.exists(filepath):
            continue
        
        # 显示图片
        try:
            img = Image.open(filepath)
            img.show()
        except Exception as e:
            print(f"无法打开 {filename}: {e}")
            continue
        
        print(f"\n文件: {filename}")
        print(f"  旧模型: {old_result}")
        print(f"  新模型: {new_result}")
        
        user_input = input("  输入标签 (回车=旧, n=新): ").strip()
        
        if user_input == "":
            labels[filename] = old_result
        elif user_input.lower() == "n":
            labels[filename] = new_result
        else:
            labels[filename] = user_input
        
        corrected += 1
        print(f"  → 已标注: {labels[filename]}")
    
    # 保存
    with open(labels_file, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)
    
    print(f"\n校对完成: {corrected} 张已更新, 共 {len(labels)} 张标签")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="人工校对验证码标签")
    system = parser.add_argument("--samples", type=str, default="./samples")
    parser.add_argument("--labels", type=str, default="labels.json")
    args = parser.parse_args()
    
    manual_label(args.samples, args.labels)
