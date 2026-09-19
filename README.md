# NJU Hub - 南京大学全场景增强插件

面向南京大学校园场景的浏览器扩展，集中提供自动登录、成绩查询、选课辅助、课表管理、课程评价、自动评教、LMS/SEEC 增强和校园网址导航等功能。

[![Manifest Version](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Version](https://img.shields.io/badge/version-26.7.0-%23660874)](https://github.com/Mellow-Winds/NJU-Hub)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## 功能模块

### 弹出面板

点击工具栏中的 NJU Hub 图标即可打开弹出面板，提供以下快捷入口和开关：

- **查看 GPA**：打开交换生平台并显示 GPA 查询结果
- **查看体育成绩**：打开体育部平台并显示体测、体育课成绩
- **网址导航**：打开校园常用网站导航
- **红黑榜查询**：打开课程评价查询页
- 模块开关：自动登录、悦读平台自动跳转、选课助手、智汇南雍增强、自动评教、SEEC 门户显示增强
- 齿轮按钮可进入完整设置页

### 自动填充，解放双手
- 自动填充统一认证页及选课系统登录页的账号密码，验证码由用户手动完成
- 登录凭证仅保存在浏览器本地

### 成绩查询，快人一步
- 点击插件图标，进入导览页，一键跳转至交换生系统（elite.nju.edu.cn），即可自动弹出弹窗显示 GPA 成绩。
- 进入体育部平台（ggtypt.nju.edu.cn）即可自动弹出弹窗显示体测和体育课成绩。

### 选课助手，优化体验
- 红黑榜库：内置约 2316 门课程、11099 条评价，支持课程名称/老师模糊查询、简称匹配和按字符顺序匹配
- 课程评价查询：结果按课程卡片展示，首次显示 90 门课程，继续滚动后分批加载；点击卡片可查看该课程的全部评价和年份
- 云端同步：从公共评价库获取最新数据，并以覆盖方式更新本地缓存
- 冲突预警：自动检测时间冲突课程
- 置顶收藏：将感兴趣的课程固定在列表顶部，一键直达
- 校区筛选：按仙林/鼓楼/浦口/苏州校区分类，核查跨校区课程
- AI 分析红黑榜：可云端同步官方 LLM 分析结果，也可以独立配置，生成个性化选课 AI 分析
- 支持默认、AI 推荐、选中概率、上课时间等排序方式
- 支持过滤时间冲突、已满课程和校区条件
- 课程卡片显示收藏、选中概率、评价数量、AI 分析、冲突和跨校区等提示
- 收藏夹支持全选、批量删除、JSON 备份和恢复
- 支持预选课程管理、已选课程管理和可选的自动确认
- 选课页面通知会以气泡形式显示，避免页面刷新或跳转过快导致信息看不到

### 课表与预选课程

- 从教务系统课表页面抓取课程到选课助手
- 合并查看已选课程和预选课程
- 提供课表网格视图、课程编辑和冲突检查
- 支持手动添加、修改和删除课程
- 支持将课表导出为独立 HTML 文件
- 选课页面可直接打开“我的课表”和预选课程管理界面

### 课程红黑榜

- 支持按课程名称和教师搜索，支持简称、连续字符和有序模糊匹配
- 点击课程卡片查看全部评价及评价年份
- 支持查看全部课程、清空搜索条件和云端同步
- 数据同步后覆盖本地缓存，无法联网时优先使用本地缓存或内置数据
- 课程分数用于信息参考，不强行划分红榜、黑榜或观望类别

### 自动评教，真·自动
- 全自动完成评教流程，锁定"很好"选项，随机生成合理评语
- 自动处理弹窗，内置丰富语料库
- 通过评教页面浮动按钮启动，无需额外配置 AI 服务

### 智汇南雍平台（LMS）增强
- 为不方便下载的课件提供下载入口

### SElearning 平台优化
- 左侧 Moodle 导航栏支持液态玻璃效果
- “课件”章节支持直接资源和文件夹资源的多文件批量下载
- 下载面板支持文件选择、进度显示、失败提示和重试
- 显示增强开关仅控制液态玻璃；批量下载默认开启

### 显示增强，自在体验
- 软件工程 SEEC 门户显示增强：优化软件工程 SEEC 平台的作业和课件界面
- 提供作业任务面板，集中查看待完成、已完成和已截止等任务
- 以卡片方式展示课程和课件，支持筛选、阅读、单个下载和批量下载
- 支持失败重试，并可通过浮动设置入口控制面板显示内容

### 网址导航，应有尽有
- 内置常用校园网址导航面板，分类清晰，可在弹出面板中一键打开
- 按校园与门户、教务与选课、课程与修读、子部门网站、其他等分类整理网址
- 卡片显示网站名称、说明和地址，并在新标签页打开
- 导航数据支持本地缓存、远程更新和内置数据回退
- 提供手动同步入口，缓存过期后也会尝试后台刷新

### 个性设置，彰显自我
- 主题色：南大紫 / 天空蓝 / 活力青 / 自定义取色
- 材质模式：普通卡片 / 更好的卡片 / 液态玻璃
- 细节打磨：调整模糊、表面透明度、降低透明度和减少动效等体验参数
- 壁纸设置和图片选择；“流溯色彩”关闭时保留原有蓝色背景，开启后按日期使用四季渐变
- 暗夜模式仅适用于普通材质，开启后使用纯黑背景
- 字体切换：Google Sans Flex + MiSans / MiSans / 系统默认
- 设置页文本框、密码框和文本域采用 Google 风格浮动标签
- 液态玻璃模式会根据背景调整文字、图标和按钮对比度
---

## 安装

### Chrome 应用商店

推荐直接从 [Chrome Web Store 安装 NJU Hub](https://chromewebstore.google.com/detail/nju-hub-%E5%8D%97%E5%A4%A7%E6%99%BA%E6%85%A7%E7%BB%88%E7%AB%AF/hahnmgdemloagldnglggfpboagmkblcf)。

### Chrome 本地加载

1. **下载源码**

   ```bash
   git clone --depth 1 https://github.com/Mellow-Winds/NJU-Hub.git
   ```

   或从 [GitHub Releases](https://github.com/Mellow-Winds/NJU-Hub/releases) 下载 `Source code (zip)` 并解压。

2. 打开 Chrome，地址栏输入 `chrome://extensions/`

3. 开启右上角**开发者模式**

4. 点击**加载已解压的扩展程序**，选择 `NJU-Hub` 文件夹

5. 点击工具栏拼图图标，找到 NJU Hub，点击图钉固定

源码加载方式可能会受到浏览器开发者模式提示影响；这是浏览器对本地未打包扩展的正常提示。

### Edge 浏览器加载

1. 打开 Edge，地址栏输入 `edge://extensions/`
2. 打开左下角 **"开发人员模式"**
3. 点击 **"加载解压缩的扩展"**，选择 `NJU-Hub` 文件夹

### Firefox 临时加载

> 需要 Firefox **115 及以上**版本。

1. 打开 Firefox，地址栏输入：
   ```
   about:debugging#/runtime/this-firefox
   ```
2. 点击 **"临时加载附加组件"（Load Temporary Add-on）**，选择 `NJU-Hub` 文件夹中的 `manifest.json`

> ⚠️ **注意**：临时加载的附加组件在 Firefox 重启后会被移除，需要重新加载。当前是临时解决方案，后续将会找Mozilla签名。

---

## 配置指南

### 基础信息

打开插件设置页（点击插件图标 → 齿轮按钮，或右键插件图标 → 选项），在**编辑个人信息**中填写昵称、学号和统一认证密码。 **所有信息仅保存在浏览器本地。** 

在设置页或弹出面板中按需开启自动登录、选课助手、LMS、SElearning、自动评教和 SEEC 增强。选课助手支持课程收藏、冲突检查、校区筛选、课表抓取和预选课程管理。

### AI 模块配置

选课助手的 AI 分析功能可按需配置接口；登录凭证自动填充无需 AI：

1. 前往任一 LLM 提供商注册获取 API Key（如 [SiliconCloud](https://siliconflow.cn)、[OpenAI](https://platform.openai.com)、[智谱 AI](https://open.bigmodel.cn) 等）
2. 在对应模块的 AI 配置区域填写 API Base URL、API Key 和模型名称
3. 保存配置后即可使用课程 AI 分析

AI 配置兼容常见的 OpenAI 风格接口，具体可用模型和接口格式以服务商文档为准。

### 选课助手额外配置

- 填写**专业背景**和**选课偏好**，AI 将据此分析课程
- 在选课助手设置页的**红黑榜**栏目点击入口，打开课程评价查询页面
- 在红黑榜页面点击顶栏**同步**，从公共评价库获取数据并覆盖本地缓存

### 红黑榜查询

- 搜索条件为课程名称和老师，支持简称、连续字符和模糊匹配
- 点击**显示所有**可以查看全部课程；结果按 90 门一批加载
- 点击课程卡片查看全部评价，评价会标注年份，便于区分不同年份的课程体验
- 课程分数仅作信息参考，不在页面上划分红榜、黑榜或观望类别

### 课表与网址导航

- 在教务系统课表页面使用选课助手提供的抓取入口，或从选课页面打开预选课程管理
- 在网址导航页面点击同步更新远程数据；网络不可用时会使用本地缓存或内置数据

### 消息订阅（仅发送给自己）

1. 可从 popup 的“邮件订阅”或设置页 → **其他功能 → 消息订阅设置**进入，首次使用需阅读并同意服务说明。
2. 点击“保存并发送测试邮件”，在自己的邮箱确认收信（也请检查垃圾邮件）。
3. 在网页选中文字，右键选择“加入 NJU-Hub 消息订阅”及模板，编辑主题、内容、样式和时间，确认实时预览后提交。

- 发件地址固定为 `onboarding@resend.dev`，无需验证域名；可修改显示名，不能修改发件地址。Resend 共享测试域名仅允许发送到账号注册邮箱，邮箱归属由 Resend 校验。
- 只支持自己发给自己：编辑页邮箱只读，后台忽略外部传入的收件地址。当前不支持他人收件、群发、抄送、附件或收件箱。未来如支持发给他人，才需要验证域名并修改 `from`。
- 不建议使用学校 `edu.cn` 邮箱注册 Resend 或收信，邮件可能被拒收或退回；建议使用自己的 QQ 邮箱、Gmail、Outlook 或其他个人邮箱。
- 编辑页提供自定义消息、作业、通知、考试/测验、课程/活动和待办事项模板；模板、标题、正文、时间和预览会保存在未发送草稿中。
- 设置页可填写“称呼”，新草稿使用“亲爱的[称呼]”，留空为“同学”。模板采用不同默认颜色，可自选内容颜色、加粗和彩色卡片；发送 HTML 邮件并提供纯文本备用正文，不支持直接输入 HTML。官方后缀固定为“——来自 NJU-Hub 消息订阅”。
- 作业、考试/测验、课程/活动及待办模板提供独立 DDL 选择，可清除；DDL 仅写入正文，不改变发送时间。样式、称呼、DDL 及来源开关随草稿保存。旧版已编辑正文或状态未确认的发送请求保留原内容和格式，避免误改及重复发送。
- API Key 仅持久化于 `chrome.storage.local`，不同步到浏览器账号，不经过 NJU-Hub 中转；**调用 API 时必须直接向 Resend 发送密钥用于鉴权**。本地存储不等于加密存储，请使用专用发送密钥，不要分享密钥。
- 只有点击发送/测试发送才会向 Resend 发送邮件内容（含称呼和 DDL）和本人邮箱。页面来源标题与 HTTP(S) 来源 URL 随草稿保存在本地；“附上来源链接”默认关闭，开启后才在邮件中加入“点击跳转来源”。请检查链接是否包含私密参数。
- 默认立即发送；可选常用时间或自定义时间，预约按本机时区解释并转换成 UTC，最多提前 30 天。提交后由 Resend 执行，关闭浏览器或卸载插件不会取消预约，可在 [Resend 控制台](https://resend.com/emails) 管理。
- “已接收请求”不代表实际投递成功；请查看邮箱和 Resend 控制台。网络中断时保留原内容重试，同一请求使用幂等键，24 小时后不再自动重试。
- 草稿在本地保留以支持刷新恢复，发送成功后清理。本地回执仅记录请求指纹、时间和结果以防重复发送，不含 API Key 或正文。额度以 Resend 控制台为准。

参考：[测试域名限制](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)、[预约发送](https://resend.com/changelog/extended-email-scheduling)、[幂等重试](https://resend.com/docs/dashboard/emails/idempotency-keys)。

### 外观设置

在个性化设置中选择主题色、材质、壁纸、字体和“流溯色彩”。流溯色彩关闭时保持原有蓝色背景；开启后，在无有效壁纸的设置页、弹出面板、红黑榜和网址导航中使用 96 色季节渐变。有效壁纸优先，弹出面板仍不显示用户壁纸。背景按 UTC+8 日期每日更新，同一天各页面使用相同色组；主题色仍控制按钮和控件。季节分组沿用 MyBlog 的近似规则：从 2 月 4 日起每组 15 天，最后一组吸收剩余天数，并非精确天文节气。暗夜模式仅适用于普通材质，无壁纸时使用压暗的季节渐变。

---

## 项目结构

```
NJU-Hub/
├── build.ps1                  # 将 options 源文件拼接生成 options/options.html
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
├── red-black/                 # 课程红黑榜查询页面
│   ├── index.html             # 查询页面入口
│   ├── app.js                 # 数据加载、模糊搜索、云端同步和弹窗逻辑
│   └── styles.css             # 响应式页面样式
├── scripts/                   # 内容脚本（注入目标页面）
│   ├── auth_auto_login.js     # 统一认证页自动登录
│   ├── xk_login_autofill.js   # 选课系统登录页自动填充
│   ├── elite_gpa_viewer.js    # GPA 查询
│   ├── auto_eval.js           # 自动评教
│   ├── lms_enhance.js         # LMS 视频/下载增强
│   ├── spoc_auto_redirect.js  # 悦读平台自动跳转
│   ├── seec_xhr_bridge.js     # SEEC Main World 数据桥接
│   ├── seec_workpanel.js      # SEEC 作业面板
│   ├── selearning_enhance.js  # SElearning 课件批量下载
│   ├── selearning_enhance.css # SElearning 左栏液态玻璃
│   ├── xk/                    # 选课助手模块
│   │   ├── xk_main.js
│   │   ├── xk_ai.js
│   │   ├── xk_conflict.js
│   │   ├── xk_storage.js
│   │   ├── xk_ui.js
│   │   ├── xk_badges.js
│   │   ├── xk_schedule.js
│   │   ├── xk_filter.js
│   │   ├── xk_preselect.js
│   │   ├── xk_notify.js
│   │   └── xk_notify_bridge.js
│   ├── schedule/              # 课表抓取与相关工具
│   └── pe_score_viewer/       # 体育成绩查看
│       ├── pe_score_fetcher.js
│       ├── pe_score_ui.js
│       └── pe_score_main.js
├── webportal/                 # 网址导航面板
│   ├── webportal.html
│   ├── webportal.css
│   ├── webportal.js
│   └── data.js
├── schedule/                  # 课表网格、编辑、同步和导出
├── libs/                      # 第三方库
│   ├── xlsx.full.min.js       # SheetJS — Excel 读写
│   └── nju-modal.js           # 自定义弹窗组件
├── data/                      # 内置数据集
├── docs/                      # 文档、隐私政策和项目页面
└── tests/                     # 自动化测试
```

---

## 隐私说明

- 学号、密码、API Key、个性化设置、收藏课程、课表和本地缓存默认保存在浏览器本地。
- 使用自用 AI 分析时，课程信息、专业背景和选课偏好会发送到用户配置的 AI 服务商，不经过 NJU-Hub 自建中转服务器。
- 课程评价、网址导航和官方 AI 分析缓存可能从项目配置的 GitHub Raw 数据源更新，也会保留本地缓存和内置回退数据。
- 扩展只在清单声明的南京大学相关站点注入对应功能脚本，具体生效页面以 manifest.json 为准。
- 详细隐私政策请见设置页 → 关于插件 → **点击查看**。

---

## 开发与验证

- 修改设置页模板或片段后运行 PowerShell 脚本 **.\build.ps1**，重新生成 options/options.html。
- 运行 **npm test** 执行自动化测试。
- 在浏览器扩展页点击重新加载后，分别检查弹出面板、设置页、红黑榜和网址导航的普通卡片、更好的卡片、液态玻璃及暗夜模式。
- 进入对应的南京大学网站，检查内容脚本是否按开关生效。
- 提交前运行 **git diff --check**。

---

## 反馈与联系

- [GitHub Issues](https://github.com/Mellow-Winds/NJU-Hub/issues) — 提交 Bug 或功能建议
- [GitHub 仓库](https://github.com/Mellow-Winds/NJU-Hub) — 欢迎 Star
- Mail：`251250226@smail.nju.edu.cn`
- QQ：`2860339144`

---

## License

MIT © [Mellow-Winds](https://github.com/Mellow-Winds)
