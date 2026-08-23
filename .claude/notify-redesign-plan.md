# 选课插件：原生通知重绘 + 刷新延迟 方案

## 一、目标

1. 拦截选课系统原生 `bh-tip` 通知，重绘为**右下角气泡**，避免与顶部浮动岛重叠。
2. 通知出现后，把系统随后的「自动刷新」**延迟约 3 秒**，解决「刷新太快看不清」。
3. 全程用 `MutationObserver` 检测元素出现，解决「没有通知时没有元素」的问题。

## 二、现状

- 浮动岛 `#xk-island-root` 定位 `top: 10px; left: 50%`（[xk_ui.js:54-58](../../scripts/xk/xk_ui.js#L54-L58)），与原生 `bh-tip`（`top: 16px; left: calc(50% - 120px)`）重叠。
- 现有代码**没有任何** `bh-tip` 处理。`bh-tip` 是系统原生 toast：仅在需要时插入 DOM、自带 `×` 关闭按钮（`bh-tip-btn-role="closeIcon"`）、部分（如「正在请求」）定时自动消失。
- 入口编排在 [xk_main.js](../../scripts/xk/xk_main.js)（`startAutoConfirm` / `startPolling`）；样式集中在 [xk_ui.js](../../scripts/xk/xk_ui.js) 的 `injectStyles`；存储键定义在 [xk_storage.js](../../scripts/xk/xk_storage.js)。

## 三、方案

### 新增 `scripts/xk/xk_notify.js`

职责：通知拦截 + 重绘 + 刷新延迟。导出 `startNotify()`，由 `xk_main.js` 调用。

**1. 样式注入（气泡容器 + 卡片）**

- 容器 `#xk-notify-root`：`position: fixed; bottom: 24px; right: 24px; z-index: 2147483646`，纵向堆叠。
- 卡片 `.xk-bubble`：圆角卡片，按类型着色（danger 红 / warning 橙 / success 绿 / info 蓝），含图标 + 文本。
- 动画：淡入 + 上滑；关闭时淡出。

**2. 检测（MutationObserver）**

- `observe(document.body, { childList: true, subtree: true })`。
- 匹配选择器：`[bh-tip-role="bhTip"]`（或 `.bh-tip`，实现时实测确认）。
- 命中后：
  - 读类型：class 含 `bh-tip-danger` → danger、`bh-tip-warning` → warning、其余 → info。
  - 读文本：`.bh-tip-content span` 的 `innerText`。
  - 隐藏原生元素：`el.style.display = 'none'`（**不 remove**，避免破坏系统对 toast 实例的引用 / 定时器）。
  - 去重：与上一条气泡文本 + 类型相同且在 ~500ms 内 → 跳过（loading 态可能连续触发）。

**3. 重绘气泡**

- 追加到 `#xk-notify-root`。
- 自动关闭：默认 ~4s 后淡出移除（用户已决定「不确认、改为延迟刷新」，气泡本身自动消失即可；时长做成可配）。
- loading 类（「正在请求」）同样自动消失、不阻塞后续。

**4. 刷新延迟**

- 新增存储键 `NJU_NOTIFY_DELAY`（默认 `3000`ms）。
- **模块加载时立即** monkey-patch：`Location.prototype.reload / assign / replace`，以及 `location.href` setter。
- 逻辑：当「最近有通知在展示」标志为真时，把真正的 `reload/assign/replace` 用 `setTimeout` 延迟 `NJU_NOTIFY_DELAY` 执行并清零标志；否则直接透传。
- 标志在检测到 `bh-tip` 时置真，在 `delay + 1s` 后自动复位。

### 修改文件

| 文件 | 改动 |
| --- | --- |
| `scripts/xk/xk_notify.js` | 新增（上述逻辑） |
| `manifest.json` | xk 的 `content_scripts` js 数组加入 `scripts/xk/xk_notify.js`（放在 `xk_storage.js` 之后、`xk_main.js` 之前） |
| `scripts/xk/xk_storage.js` | `STORAGE` 增加 `NOTIFY_DELAY: 'NJU_NOTIFY_DELAY'` |
| `scripts/xk/xk_main.js` | 启动阶段调用 `window.__XK__.startNotify()`（与 `startAutoConfirm` 并列） |

## 四、实现第一步要先实测确认

1. `bh-tip` 精确选择器与出现时机（DevTools 里 `console.log` 观察）。
2. 「自动刷新」是完整 `location.reload()` 还是 SPA 局部重查（axios 重查列表）：
   - 若为 location 类 → 上面的 patch 直接生效。
   - 若为 SPA 局部重查 → 气泡是我们自己的 DOM 不会被清掉；但「已选/上限」数字会立即更新。若要连列表刷新一起延迟，需定位框架刷新调用点（Vue router / 列表组件方法）再针对性 hook。
3. 同步刷新竞态：若系统「show toast → 立即 reload」在同一脚本内同步执行，MutationObserver 回调（微任务）可能晚于 reload。缓解：patch 在模块加载时即生效；极端同步场景退化为「无条件延迟 reload」（加白名单豁免插件自己的 `location.reload`，即 [xk_ui.js:366](../../scripts/xk/xk_ui.js#L366)、[xk_ui.js:514](../../scripts/xk/xk_ui.js#L514)）。

## 五、验收

- 选课操作触发通知时，顶部不再被浮动岛遮挡，右下角出现对应类型的气泡。
- 通知出现后系统刷新延迟约 3s，用户能看清内容。
- 无通知时页面行为不变（observer 空转，无副作用）。
