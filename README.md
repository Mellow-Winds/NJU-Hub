# 🏫 NJU Hub — 南大智慧终端

> 南京大学个人学术指挥中心：一站式浏览器扩展，覆盖 GPA 查询、自动登录、智能选课分析、LMS 增强、自动评教与 SEEC 门户优化。

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-2.0.1-%23660874)](https://github.com/Mellow-Winds/NJU-Hub)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ 功能模块

### 🔐 自动登录
- **AI 验证码识别**：在统一认证登录页自动识别图形验证码并填充账号密码
- 支持自动填充（Auto Fill）与自动提交（Auto Login）两种模式
- 兼容 SiliconCloud / OpenAI / 智谱 等多家大模型 API

### 📊 GPA 快速查询
- 点击插件图标一键跳转至交换生网站（elite.nju.edu.cn）查看 GPA
- 无需手动导航多级菜单

### 📚 选课助手
- **红黑榜分析**：基于专业背景与个人偏好，AI 分析课程评价，标注"红榜"与"黑榜"
- **冲突预警**：自动检测时间冲突课程
- **置顶收藏**：将感兴趣的课程固定在选课列表顶部
- **校区筛选**：按仙林/鼓楼/浦口/苏州校区选择，核查是否跨校区
- **SeaTable 云端同步**：对接学长维护的公共评价库，一键同步课程评价数据
- 支持导入 Excel 评价数据（从 https://table.nju.edu.cn/external-apps/7aded834-74a2-43cc-b515-fb8e01656ef2 下载），批量管理课程评价
- AI 配置独立，可选用不同 API Key 与模型

### 🎓 自动评教
- 全自动评教：锁定"很好"选项，随机生成合理评语
- 自动处理弹窗，全程自动完成
- 内置语料库，无需额外 AI 配置

### 🎬 智汇南雍（LMS）增强
- **课件批量下载**：下载列表默认全选 + 文件选择框

### 显示增强
目前适配的有如下网站：
1. 软件工程：SEEC门户网站显示增强：优化作业界面显示（待完成/已完成/已截止）和课件界面显示

### 🎨 个性化
- **主题色**：南大紫 / 天空蓝 / 活力青 / 自定义取色
- **暗夜模式**：保护视力
- **字体切换**：Google Sans Flex + MiSans / MiSans / 系统默认

---

## 📦 安装指南

### 方式一：Chrome 开发者模式加载

1. **下载源码**

   ```bash
   # 克隆仓库
   git clone https://github.com/Mellow-Winds/NJU-Hub.git
   ```
   
   或从 [GitHub Releases](https://github.com/Mellow-Winds/NJU-Hub/releases) 下载 `Source code (zip)` 并解压到本地文件夹。

2. **打开 Chrome 扩展管理页面**

   在 Chrome 地址栏输入：
   ```
   chrome://extensions/
   ```

3. **开启开发者模式**

   点击页面右上角的 **"开发者模式"（Developer mode）** 开关。

4. **加载插件**

   点击左上角出现的 **"加载已解压的扩展程序"（Load unpacked）** 按钮，然后选择刚解压/克隆的 `NJU-Hub` 文件夹。

5. **固定到工具栏**

   点击 Chrome 工具栏右侧的 🧩 拼图图标，找到 **"NJU Hub - 南大智慧终端"**，点击 📌 图钉固定。

> ⚠️ **注意**：由于插件未上架 Chrome 应用商店，每次浏览器重启后 Chrome 可能会提示"请停用开发者模式扩展程序"，点击取消即可继续使用。

### 方式二：Edge 浏览器加载

1. 打开 Edge，地址栏输入 `edge://extensions/`
2. 打开左下角 **"开发人员模式"**
3. 点击 **"加载解压缩的扩展"**，选择 `NJU-Hub` 文件夹


---

## ⚙️ 配置指南

### 基础配置

1. 点击插件图标 → ⚙️ 设置按钮（或右键插件图标 → "选项"）
2. 在 **"个人信息设置"** 中填写昵称（作为插件页的展示）、学号与统一认证密码（作为自动登录填充内容）
   - 所有信息仅保存在浏览器本地存储，不上传任何云端

### AI 模块配置（自动登录 / 选课助手）

1. **获取 API Key**：前往任一 LLM 提供商注册并获取 Key
   - [SiliconCloud](https://siliconflow.cn)
   - [OpenAI](https://platform.openai.com)
   - [智谱 AI](https://open.bigmodel.cn)
   ......
2. 在对应模块（自动登录 / 选课助手）的 **"AI 配置"** 区域填写：
   - **API Base URL**：如 `https://api.siliconflow.cn/v1`
   - **API Key**：你的密钥
   - **AI Model**：使用的模型（具体参考 LLM 提供商的使用文档）
3. 各模块的 AI 配置互相独立，可按需使用不同提供商和模型

### 选课助手额外配置

- 填写 **专业背景** 和 **选课偏好 Prompt**，AI 将据此分析课程推荐
- 点击 **"立即同步"** 可以从公共评价库获取课程评价
- 也可通过 **导入/导出** 按钮管理本地评价数据

---

## 🗂️ 项目结构

```
NJU-Hub/
├── manifest.json          # 扩展清单（Manifest V3）
├── background.js          # Service Worker — AI 请求转发 + SeaTable 网关
├── icons/                 # 扩展图标
├── popup/                 # 弹出面板（快捷开关 + GPA 入口）
│   ├── index.html
│   ├── style.css
│   └── popup.js
├── options/               # 设置页面（完整配置中心）
│   ├── options.html
│   ├── options.css
│   ├── options.js
│   ├── material-color-utils.js
│   └── fonts/
├── scripts/               # 内容脚本（注入目标页面）
│   ├── login.js           # 统一认证页自动登录
│   ├── gpa.js             # 精英系统 GPA 查询
│   ├── course_helper.js   # 选课系统增强
│   ├── eval.js            # 自动评教
│   ├── lms.js             # LMS 视频/下载增强
│   ├── inject.js          # SEEC 注入脚本
│   └── seec_workpanel_enhance_v22.js  # SEEC 作业面板
├── libs/                  # 第三方库
│   ├── xlsx.full.min.js   # SheetJS — Excel 读写
│   └── nju-modal.js       # 自定义弹窗组件
└── options-ui/            # 新版设置页（Next.js 构建中）
```

---

## 🔒 隐私说明

- **所有个人数据（学号、密码、API Key）仅存储在浏览器本地**，不上传至任何远程服务器
- AI 请求通过浏览器扩展的 Service Worker 直接转发至你配置的 API 提供商，不经过第三方中间服务器
- 选课助手与 SeaTable 的通信仅用于拉取公共评价数据，不发送任何个人信息
- 详细隐私政策请见设置页 **"关于插件"** → **"查看隐私政策"**

---

## 📮 反馈与联系

- 🐛 [GitHub Issues](https://github.com/Mellow-Winds/NJU-Hub/issues) — 提交 Bug 或功能建议
- ⭐ [GitHub 仓库](https://github.com/Mellow-Winds/NJU-Hub) — 欢迎 Star 支持喵！
- 📧 Mail：`251250226@smail.nju.edu.cn`
- 💬 QQ：`2860339144`

---

## 📄 License

MIT © [Mellow-Winds](https://github.com/Mellow-Winds)
