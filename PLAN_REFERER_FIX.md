# Plan: 修复课表跳转 Referer 防盗链 + Options 页缺按钮

## 问题一：选课插件 → ehall 课表跳转"非法"

### 根因

`xk_ui.js:374` 在选课页面通过 `window.open()` 跳转到 ehall 课表：

```js
window.open('https://ehallapp.nju.edu.cn/jwapp/sys/wdkb/*default/index.do#/xskcb', '_blank');
```

这是一个 content script，运行在 `xk.nju.edu.cn` 页面上下文中。
浏览器跳转时自动携带 `Referer: https://xk.nju.edu.cn/...`，
`ehallapp.nju.edu.cn` 检测到 Referer 非自身域名 → 拒绝，显示"非法"。

复制链接到地址栏粘贴 → 浏览器不发送 Referer → 正常打开 ✅

### 方案

在 `background.js` 中新增 `declarativeNetRequest` 规则，
对跳转到 `*.nju.edu.cn` 的**主框架导航**自动剥离 `Referer` 头。

利用已有的 `chrome.declarativeNetRequest.updateSessionRules` API，
新增一条 `resourceTypes: ["main_frame"]` 的规则：

```
条件: urlFilter "*://*.nju.edu.cn/*" + resourceTypes ["main_frame", "sub_frame"]
动作: 移除 referer + origin 请求头
```

> 为什么用 `*.nju.edu.cn` 通配？所有 NJU 子域名都可能做同样的防盗链检查，
> 一条规则覆盖全局，以后加新链接也不用再改。

### 修改文件

**`background.js`** — 新增 `NAVIGATION_RULE_ID = 2` 规则，扩展自启时注册。

改动量：约 20 行。

---

## 问题二：Options 页面缺少"导入课表"按钮

### 现状

`options.html` 选课助手区域（[L171-174](options/options.html#L171-L174)）只有两个按钮：

| 按钮 | 功能 |
|------|------|
| 查看我的课表 | 打开 Modal 展示已同步的课表 |
| 清空课表 | 删除已同步的课表 |

点击"查看我的课表" → Modal 底部有一个不显眼的"打开课表页面"按钮 → 跳转 ehall。

用户一眼看过去不知道去哪导入课表，操作链条太深。

### 方案

在 options.html 的选课助手区域，**"查看我的课表"旁边新增一个"导入课表"按钮**，
直接跳到 ehall 课表页，与 xk_ui.js 里的浮动岛"导入课表"行为一致。

### 修改文件

1. **`options/options.html`** — 在 `btn-view-schedule` 和 `btn-clear-schedule` 所在行加一个 `<button id="btn-import-schedule">导入课表</button>`
2. **`options/modules/course.js`** — 在 `initCourseModule()` 里绑定 click 事件：`chrome.tabs.create({ url: 'ehallapp...' })`

改动量：约 5 行 HTML + 5 行 JS。

---

## 实施步骤

1. 改 `background.js`：新增导航 Referer 剥离规则
2. 改 `options/options.html`：加"导入课表"按钮
3. 改 `options/modules/course.js`：绑定按钮事件
4. 加载扩展测试：① 选课页点"导入课表"不再非法 ② Options 页点"导入课表"正常跳转
