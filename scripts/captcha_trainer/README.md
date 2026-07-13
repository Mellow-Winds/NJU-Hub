# 验证码采集与训练工具

## 用途
采集南大验证码样本，训练专用 ONNX 模型，替换 ddddocr 通用模型提升准确率。

## 流程
1. `collect.py` — 批量采集验证码图片（目标 500+ 张）
2. `auto_label.py` — 用 ddddocr + LLM 双重验证自动标注
3. `train.py` — 训练小型 CNN + CTC loss
4. `export_onnx.py` — 导出 ONNX 模型
5. 将生成的 `captcha_custom.onnx` 复制到 `libs/` 替换 `common_old.onnx`

## 运行环境
```
pip install ddddocr onnxruntime pillow requests torch torchvision
```
