# venue_ocr — 场馆验证码识别资源

智慧场馆（ggtypt.nju.edu.cn）点选验证码自动识别所用模型与运行时，供
`scripts/venue_grab/vg_captcha_ai.js` 调用（经 `vg_ocr_bundle.js` 打包的
ddddocr-js 推理管线，onnxruntime-web 驱动）。

## 内容

| 文件 | 说明 |
| --- | --- |
| `common.onnx` | ddddocr 识别模型（beta 版，中文单字识别） |
| `common_det.onnx` | ddddocr 文字检测模型（YOLOv8，定位图中文字框） |
| `common.json` | 识别模型字符集 |
| `wasm/*.wasm` `wasm/*.mjs` | onnxruntime-web wasm 运行时及 emscripten 胶水 |
| `vg_ocr_bundle.js` | 推理管线打包产物（esbuild；源码见 scripts/venue_grab/ 调用方） |

## 来源与许可

模型与算法来自 [ddddocr](https://github.com/sml2h3/ddddocr) 及其 JavaScript
移植 [ddddocr-js](https://github.com/J3n5en/ddddocr-js)，ONNX Runtime Web 来自
[microsoft/onnxruntime](https://github.com/microsoft/onnxruntime)，均为 MIT 许可。
