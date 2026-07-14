/**
 * libs/captcha_ocr.js
 *
 * 基于ddddocr预训练ONNX模型的浏览器端验证码识别模块
 * 使用 onnxruntime-web 进行本地推理，无需调用外部API
 *
 * 模型: common_old.onnx (ddddocr旧版OCR模型)
 * 输入: [1, 1, 64, W] (灰度图，高度固定64，宽度按比例缩放)
 * 输出: [seqlen, 1, 8210] (CTC编码的字符概率序列)
 * 字符集: 8210个字符（含中文、英文、数字等）
 *
 * 推理流程:
 * 1. 将验证码图片绘制到Canvas → 获取ImageData
 * 2. 等比缩放至高度64 → 转灰度 → 归一化到[0,1]
 * 3. 构造Float32Array输入 → ONNX推理
 * 4. 对输出做argmax + CTC解码 → 得到字符
 */

(function (global) {
    'use strict';

    const MODEL_CONFIG = {
        modelPath: chrome.runtime.getURL('libs/common_old.onnx'),
        charsetPath: chrome.runtime.getURL('libs/charset_old.json'),
        ortJsPath: chrome.runtime.getURL('libs/ort-wasm/ort.wasm.bundle.min.mjs'),
        inputName: 'input1',
        targetHeight: 64,
        charsetSize: 8210
    };

    let session = null;
    let charset = null;
    let initPromise = null;
    let initError = null;

    /**
     * 初始化ONNX运行时和模型（懒加载，只执行一次）
     * @returns {Promise<{session: Object, charset: string[]}>}
     */
    async function init() {
        // 如果已成功初始化，直接返回
        if (session && charset) return { session, charset };
        // 如果有正在进行的初始化，等待它
        if (initPromise) return initPromise;
        // 清除之前的失败状态，允许重试
        if (initError) {
            console.log('[CaptchaOCR] 重新尝试初始化（上次失败: %s）...', initError.message || initError);
            initError = null;
        }

        initPromise = (async () => {
            try {
                console.log('[CaptchaOCR] 开始初始化...');
                console.log('[CaptchaOCR] 模型路径:', MODEL_CONFIG.modelPath);
                console.log('[CaptchaOCR] 字符集路径:', MODEL_CONFIG.charsetPath);
                console.log('[CaptchaOCR] ORT JS 路径:', MODEL_CONFIG.ortJsPath);

                // 1. 加载 ort 运行时
                console.log('[CaptchaOCR] [1/3] 加载 onnxruntime-web...');
                const ort = await import(MODEL_CONFIG.ortJsPath);
                global.ort = ort;
                console.log('[CaptchaOCR] [1/3] ort 加载成功, 版本:', ort.env?.version || 'unknown');

                // 2. 加载字符集
                console.log('[CaptchaOCR] [2/3] 加载字符集...');
                const charsetResp = await fetch(MODEL_CONFIG.charsetPath);
                if (!charsetResp.ok) {
                    throw new Error(`字符集加载失败: HTTP ${charsetResp.status} - ${MODEL_CONFIG.charsetPath}`);
                }
                charset = await charsetResp.json();
                console.log(`[CaptchaOCR] [2/3] 字符集加载完成: ${charset.length} 字符`);

                // 3. 加载ONNX模型
                console.log('[CaptchaOCR] [3/3] 加载 ONNX 模型 (可能需要几秒)...');
                session = await ort.InferenceSession.create(MODEL_CONFIG.modelPath, {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all'
                });
                console.log('[CaptchaOCR] [3/3] 模型加载完成!');
                console.log('[CaptchaOCR]   输入节点:', session.inputNames);
                console.log('[CaptchaOCR]   输出节点:', session.outputNames);

                return { session, charset };
            } catch (e) {
                initPromise = null;
                initError = e;
                console.error('[CaptchaOCR] 初始化失败:', e);
                console.error('[CaptchaOCR] 错误详情:', e.message || e);
                if (e.stack) console.error('[CaptchaOCR] 堆栈:', e.stack);
                throw e;
            }
        })();

        return initPromise;
    }

    /**
     * 将图片元素预处理为模型输入张量
     * 增强预处理：灰度 → 对比度拉伸 → 中值滤波去噪 → 二值化 → 归一化
     * @param {HTMLImageElement} img - 验证码图片元素
     * @returns {Float32Array} - 形状为 [1, 1, 64, W] 的浮点数组
     */
    function preprocessImage(img) {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // 等比缩放：目标高度=64，宽度按比例
        const targetH = MODEL_CONFIG.targetHeight;
        const targetW = Math.round(srcW * (targetH / srcH));

        // 绘制到Canvas并获取像素数据
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, targetW, targetH);
        const imageData = ctx.getImageData(0, 0, targetW, targetH);
        const pixels = imageData.data;

        // === 1. 转灰度 + 归一化到 [0, 1] ===
        // ddddocr 标准预处理：仅灰度 + 归一化，不做二值化
        const float32 = new Float32Array(targetH * targetW);
        for (let i = 0; i < targetH * targetW; i++) {
            const idx = i * 4;
            const grayVal = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            float32[i] = grayVal / 255.0;
        }

        console.log(`[CaptchaOCR] 预处理: ${srcW}x${srcH} → ${targetW}x${targetH} (灰度归一化)`);

        return { data: float32, width: targetW, height: targetH };
    }

    /**
     * 将Base64图片预处理为模型输入张量
     * @param {string} dataUrl - data:image/...;base64,... 格式
     * @returns {Promise<{data: Float32Array, width: number, height: number}>}
     */
    function preprocessBase64(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    resolve(preprocessImage(img));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = dataUrl;
        });
    }

    /**
     * CTC解码：去除连续重复和blank字符(索引0)
     * @param {Int32Array} indices - argmax后的索引数组
     * @returns {number[]} - 解码后的字符索引列表
     */
    function ctcDecode(indices) {
        const decoded = [];
        let prev = -1;
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            if (idx !== prev && idx !== 0) {
                decoded.push(idx);
            }
            prev = idx;
        }
        return decoded;
    }

    /**
     * 识别验证码
     * @param {HTMLImageElement|string} imgOrBase64 - 图片元素或base64 data URL
     * @returns {Promise<string|null>} - 识别结果，失败返回null
     */
    async function recognize(imgOrBase64) {
        const startTime = performance.now();
        try {
            console.log('[CaptchaOCR] === 开始识别 ===');
            console.log('[CaptchaOCR] 输入类型:', typeof imgOrBase64 === 'string' ? 'base64' : 'HTMLImageElement');

            await init();

            // 预处理
            console.log('[CaptchaOCR] 预处理图片...');
            let processed;
            if (typeof imgOrBase64 === 'string') {
                processed = await preprocessBase64(imgOrBase64);
            } else if (imgOrBase64 instanceof HTMLImageElement) {
                processed = preprocessImage(imgOrBase64);
            } else {
                throw new Error('不支持的输入类型: ' + typeof imgOrBase64);
            }
            console.log(`[CaptchaOCR] 预处理完成: ${processed.width}x${processed.height}, 数据量=${processed.data.length}`);

            // 构造ONNX输入张量: [1, 1, 64, W]
            console.log('[CaptchaOCR] 构造输入张量: [1, 1, %d, %d]', processed.height, processed.width);
            const inputTensor = new ort.Tensor(
                'float32',
                processed.data,
                [1, 1, processed.height, processed.width]
            );

            // 推理
            console.log('[CaptchaOCR] 开始 ONNX 推理...');
            const inferStart = performance.now();
            const results = await session.run({ [MODEL_CONFIG.inputName]: inputTensor });
            const inferTime = (performance.now() - inferStart).toFixed(1);
            console.log(`[CaptchaOCR] 推理完成 (${inferTime}ms)`);

            const output = results[session.outputNames[0]];
            console.log('[CaptchaOCR] 输出维度:', output.dims);
            console.log('[CaptchaOCR] 输出数据长度:', output.data.length);

            // 输出形状: [seqlen, 1, 8210]
            const outputData = output.data;
            const seqlen = output.dims[0];
            const batchSize = output.dims[1]; // = 1
            const numClasses = output.dims[2]; // = 8210
            console.log(`[CaptchaOCR] seqlen=${seqlen}, batch=${batchSize}, numClasses=${numClasses}`);

            // argmax: 对每个时间步取最大概率的字符索引
            const predicted = new Int32Array(seqlen);
            for (let t = 0; t < seqlen; t++) {
                let maxIdx = 0;
                let maxVal = -Infinity;
                const offset = t * batchSize * numClasses; // [t, 0, :]
                for (let c = 0; c < numClasses; c++) {
                    const val = outputData[offset + c];
                    if (val > maxVal) {
                        maxVal = val;
                        maxIdx = c;
                    }
                }
                predicted[t] = maxIdx;
            }
            console.log('[CaptchaOCR] argmax 结果:', Array.from(predicted));

            // CTC解码
            const decoded = ctcDecode(predicted);
            console.log('[CaptchaOCR] CTC 解码后索引:', decoded);

            // 转字符
            const result = decoded.map(idx => charset[idx] || '').join('');
            console.log('[CaptchaOCR] 映射字符:', decoded.map(idx => `[${idx}]=${charset[idx] || '?'}`));

            const totalTime = (performance.now() - startTime).toFixed(1);
            console.log(`[CaptchaOCR] === 识别完成: "${result}" (总耗时 ${totalTime}ms) ===`);
            return result || null;

        } catch (e) {
            const totalTime = (performance.now() - startTime).toFixed(1);
            console.error(`[CaptchaOCR] 识别失败 (${totalTime}ms):`, e);
            console.error('[CaptchaOCR] 错误详情:', e.message || e);
            if (e.stack) console.error('[CaptchaOCR] 堆栈:', e.stack);
            return null;
        }
    }

    // 导出
    global.CaptchaOCR = {
        init,
        recognize,
        isReady: () => session !== null && charset !== null
    };

})(typeof window !== 'undefined' ? window : self);
