"""
export_onnx.py — 将训练好的 PyTorch 模型导出为 ONNX 格式 + 字符集文件

用法:
    python export_onnx.py --checkpoint best_model.pt --output captcha_custom.onnx

导出后:
    将 captcha_custom.onnx 复制到插件 libs/ 目录
    将 charset_custom.json 复制到插件 libs/ 目录
    修改 captcha_ocr.js 中的 MODEL_CONFIG 指向新文件
"""

import argparse
import json
import torch
import numpy as np
from train import CaptchaCNN, TARGET_HEIGHT, TARGET_WIDTH, NUM_CLASSES, CHARSET


def export_onnx(checkpoint_path, output_path):
    # 加载模型
    model = CaptchaCNN()
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model.load_state_dict(ckpt["model"])
    model.eval()

    charset = ckpt.get("charset", CHARSET)
    print(f"字符集 ({len(charset)}): {charset}")
    print(f"类别数: {NUM_CLASSES} (含blank)")

    # 创建示例输入（固定尺寸 64x192）
    dummy_input = torch.randn(1, 1, TARGET_HEIGHT, TARGET_WIDTH)

    # 导出 ONNX
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input1"],
        output_names=["output"],
        dynamic_axes={
            "input1": {0: "batch", 3: "width"},
            "output": {0: "seq_len", 1: "batch"},
        },
    )

    # 验证导出的模型
    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)

    file_size = len(open(output_path, "rb").read())
    print(f"\n导出成功!")
    print(f"  文件: {output_path}")
    print(f"  大小: {file_size / 1024 / 1024:.2f} MB")
    print(f"  输入: input1 [batch, 1, {TARGET_HEIGHT}, {TARGET_WIDTH}]")
    print(f"  输出: output [seq_len, batch, {NUM_CLASSES}]")

    # 导出字符集文件（与插件 captcha_ocr.js 兼容的格式）
    charset_path = output_path.replace(".onnx", "_charset.json")
    # 插件期望的格式: JSON 数组，index 0 = blank，index 1..N = 字符
    charset_array = [""] + list(charset)  # index 0 = blank (空字符串)
    with open(charset_path, "w", encoding="utf-8") as f:
        json.dump(charset_array, f, ensure_ascii=False)
    print(f"  字符集: {charset_path} ({len(charset_array)} 项, 含blank)")

    # 用 onnxruntime 验证推理
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(output_path)
        input_name = sess.get_inputs()[0].name
        output_info = sess.get_outputs()[0]

        test_input = np.random.randn(1, 1, TARGET_HEIGHT, TARGET_WIDTH).astype(np.float32)
        result = sess.run(None, {input_name: test_input})
        print(f"  推理测试: 输入 {test_input.shape} → 输出 {result[0].shape}")
        print(f"  输入名: {input_name}")
        print(f"  输出名: {output_info.name}")
    except ImportError:
        print("  (onnxruntime 未安装，跳过推理验证)")

    print(f"\n下一步:")
    print(f"  1. 将 {output_path} 复制到插件 libs/ 目录")
    print(f"  2. 将 {charset_path} 复制到插件 libs/ 目录")
    print(f"  3. 修改 captcha_ocr.js 中的 MODEL_CONFIG:")
    print(f"     modelPath → captcha_custom.onnx")
    print(f"     charsetPath → charset_custom.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出 ONNX 模型")
    parser.add_argument("--checkpoint", type=str, default="best_model.pt", help="PyTorch 检查点")
    parser.add_argument("--output", type=str, default="captcha_custom.onnx", help="输出 ONNX 路径")
    args = parser.parse_args()

    export_onnx(args.checkpoint, args.output)
