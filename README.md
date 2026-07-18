# NJU Hub - 南京大学全场景增强插件

南京大学校园浏览器扩展，一站式解决 GPA 查询、自动登录、选课分析、自动评教、LMS 增强等日常需求。

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-26.1.5-%23660874)](https://github.com/Mellow-Winds/NJU-Hub)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 功能模块

### 自动登录，解放双手
- 本地模型/云端 AI 双轨验证码识别，自动填充统一认证页的账号密码
- 支持自动填充和自动登录两种增强
- 兼容 SiliconCloud / OpenAI / 智谱等大模型 API
- 悦读平台（SPOC）未登录时自动跳转认证，登录快人一步。

### 成绩查询，快人一步
- 点击插件图标，进入导览页，一键跳转至交换生系统（elite.nju.edu.cn），即可自动弹出弹窗显示 GPA 成绩。
- 进入体育部平台（ggtypt.nju.edu.cn）即可自动弹出弹窗显示体测和体育课成绩。

### 选课助手，优化体验
- 红黑榜库：内置评价库，覆盖五年数据，12000+评价数据内置，更支持云端同步，对接公共评价库，一键获取课程评价
- 冲突预警：自动检测时间冲突课程
- 置顶收藏：将感兴趣的课程固定在列表顶部，一键直达
- 校区筛选：按仙林/鼓楼/浦口/苏州校区分类，核查跨校区课程
- AI 分析红黑榜：可云端同步官方LLM分析结果，也可以独立配置，生成个性化选课AI分析。

### 自动评教，真·自动
- 全自动完成评教流程，锁定"很好"选项，随机生成合理评语
- 自动处理弹窗，内置丰富语料库

### 智汇南雍平台（LMS）增强，下载无忧
- 解除视频播放限制
- 视频自动连播
- 突破下载限制，解决没有"下载"按钮，或只能单一下载的困境，提供更方便的途径将课件保存到电脑上

### 显示增强，自在体验
- 软件工程 SEEC 门户显示增强：优化软件工程 SEEC 平台的作业和课件界面

### 网址导航，应有尽有
- 内置常用校园网址导航面板，分类清晰，可在弹出面板中一键打开

### 个性设置，彰显自我
- 主题色：南大紫 / 天空蓝 / 活力青 / 自定义取色
- 暗夜模式
- 字体切换：Google Sans Flex + MiSans / MiSans / 系统默认

### 更多功能开发中...
---

## 安装指南

### Chrome 开发者模式加载

1. **下载源码**

   ```bash
   git clone https://github.com/Mellow-Winds/NJU-Hub.git
   ```

   或从 [GitHub Releases](https://github.com/Mellow-Winds/NJU-Hub/releases) 下载 `Source code (zip)` 并解压。

2. 打开 Chrome，地址栏输入 `chrome://extensions/`

3. 开启右上角**开发者模式**

4. 点击**加载已解压的扩展程序**，选择 `NJU-Hub` 文件夹

5. 点击工具栏拼图图标，找到 NJU Hub，点击图钉固定

> 注意：插件未上架 Chrome 应用商店，每次浏览器重启后可能会提示"请停用开发者模式扩展程序"，点击取消即可继续使用。

### Edge 浏览器加载

1. 打开 Edge，地址栏输入 `edge://extensions/`
2. 开启左下角**开发人员模式**
3. 点击**加载解压缩的扩展**，选择 `NJU-Hub` 文件夹

---

## 配置指南

### 基础信息

打开插件设置页（点击插件图标 → 齿轮按钮，或右键插件图标 → 选项），在**编辑个人信息**中填写昵称、学号和统一认证密码。 **所有信息仅保存在浏览器本地。** 

### AI 模块配置

自动登录和选课助手需要配置 AI 接口：

1. 前往任一 LLM 提供商注册获取 API Key（如 [SiliconCloud](https://siliconflow.cn)、[OpenAI](https://platform.openai.com)、[智谱 AI](https://open.bigmodel.cn) 等）
2. 在对应模块的 AI 配置区域填写 API Base URL、API Key 和模型名称
3. 自动登录需要支持视觉识别的模型（用于验证码识别）
4. 各模块 AI 配置互相独立，可按需使用不同提供商

### 选课助手额外配置

- 填写**专业背景**和**选课偏好**，AI 将据此分析课程
- 点击**同步评价库**从公共库获取课程评价
- 可通过**导出评价**按钮导出本地数据

---

## 项目结构

```
NJU-Hub/
├── manifest.json              # 扩展清单（Manifest V3）
├── background.js              # Service Worker — AI 请求转发 + 请求头处理
├── icons/                     # 扩展图标
├── popup/                     # 弹出面板（快捷开关 + GPA/体育成绩/网址导航入口）
│   ├── index.html
│   ├── style.css
│   └── popup.js
├── options/                   # 设置页面
│   ├── template.html          # 页面模板
│   ├── options.html           # 由 build.ps1 拼接生成
│   ├── options.css
│   ├── options.js
│   ├── material-color-utils.js
│   ├── modules/               # 各模块 JS 逻辑
│   │   ├── course.js
│   │   ├── eval.js
│   │   ├── lms.js
│   │   ├── login.js
│   │   └── seec.js
│   ├── sections/              # 各模块 HTML 片段
│   │   ├── about.html
│   │   ├── course.html
│   │   ├── general.html
│   │   ├── login.html
│   │   ├── other.html
│   │   ├── personalize.html
│   │   └── seec.html
│   └── fonts/
├── scripts/                   # 内容脚本（注入目标页面）
│   ├── auth_auto_login.js     # 统一认证页自动登录
│   ├── elite_gpa_viewer.js    # GPA 查询
│   ├── auto_eval.js           # 自动评教
│   ├── lms_enhance.js         # LMS 视频/下载增强
│   ├── spoc_auto_redirect.js  # 悦读平台自动跳转
│   ├── seec_xhr_bridge.js     # SEEC Main World 数据桥接
│   ├── seec_workpanel.js      # SEEC 作业面板
│   ├── xk/                    # 选课助手模块
│   │   ├── xk_main.js
│   │   ├── xk_ai.js
│   │   ├── xk_conflict.js
│   │   ├── xk_storage.js
│   │   ├── xk_ui.js
│   │   ├── xk_badges.js
│   │   └── xk_schedule.js
│   ├── pe_score_viewer/       # 体育成绩查看
│   │   ├── pe_score_fetcher.js
│   │   ├── pe_score_ui.js
│   │   └── pe_score_main.js
│   └── captcha_trainer/       # 验证码识别训练工具
├── webportal/                 # 网址导航面板
│   ├── webportal.html
│   ├── webportal.css
│   ├── webportal.js
│   └── data.js
├── libs/                      # 第三方库
│   ├── xlsx.full.min.js       # SheetJS — Excel 读写
│   ├── captcha_ocr.js         # 验证码 OCR 库
│   └── nju-modal.js           # 自定义弹窗组件
├── data/                      # 内置数据集
├── docs/                      # 文档（隐私政策等）
└── FYP/                       # 毕设项目 — 独立脚本与历史版本
```

---

## 隐私说明

- 所有个人数据（学号、密码、API Key）仅存储在浏览器本地，不上传任何远程服务器。如果您对此表示怀疑，可以使用AI分析代码风险，确认后再使用。
- AI 请求通过扩展 Service Worker 直接转发至你配置的 API 提供商，不经过第三方
-  选课助手 与 红黑榜 的通信仅用于拉取公共评价数据，不发送个人信息
- 详细隐私政策请见设置页 → 关于插件 → 查看隐私政策

---

## 反馈与联系

- [GitHub Issues](https://github.com/Mellow-Winds/NJU-Hub/issues) — 提交 Bug 或功能建议
- [GitHub 仓库](https://github.com/Mellow-Winds/NJU-Hub) — 欢迎 Star
- Mail：`251250226@smail.nju.edu.cn`
- QQ：`2860339144`

---

## License

MIT © [Mellow-Winds](https://github.com/Mellow-Winds)
