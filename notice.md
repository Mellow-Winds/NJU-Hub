这个扩展的全部功能都依赖南京大学统一认证系统，测试者必须持有有效的南大学号及统一认证密码。所有模块触发页面均为南大内网站点，校外测试需先连接学校 VPN。

没有提供公共测试账号，每人使用自己的学号。密码和 API Key 都只保存在浏览器本地 chrome.storage.local，可以通过 Chrome DevTools 的 Application → Storage 面板直接查看。

各模块和它注入的页面一一对应：自动登录只在 authserver.nju.edu.cn/authserver/login 页面生效；GPA 查询点击插件按钮后跳转到 elite.nju.edu.cn/exchangesystem；选课助手在办事大厅的课表页面和选课系统页面触发；自动评教在办事大厅的评教页面生效，但评教功能只有在学期末评教窗口开放时才能实际测试；LMS 增强在 lms.nju.edu.cn 整个域名下生效；SEEC 门户增强只对选修了软件工程课程的学生可见，域名是 p-nju.seec.seecoder.cn。

自动登录的验证码识别是 AI 驱动的，测试前需要在插件设置里配置 LLM API。建议用 SiliconCloud（siliconflow.cn），注册就送额度，国内直连不用翻墙。API Base URL 填 https://api.siliconflow.cn/v1，Vision Model 填 Qwen/Qwen3-8B，再把获取的 Key 贴进去就行。选课助手的 AI 分析用的是另外一套独立配置，可以用同一家的 Key 和模型，也可以换成别家。

选课助手里那个"立即同步"按钮是从 SeaTable 公共评价库拉数据，域名是 table.nju.edu.cn，必须校园网或 VPN 才能访问。后台的 Service Worker 会自动剥离 Origin 和 Referer 头来绕过网关限制，这部分逻辑在 background.js 里，如果同步失败可以先排查网络，再看 DevTools 里 Service Worker 的 console 日志。

自动评教不需要 AI 配置，它内置了一套评语语料库，状态机会自动把所有选项锁到"很好"然后随机生成评语。点击右下角的浮动按钮就启动。

所有内容（密码、KEY等）全部保存本地，不上传云端。