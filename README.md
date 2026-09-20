# 目标任务空间 · AI 原生 iOS 概念设计

一个正在产品化的跨平台 AI task orchestration 项目：把用户直接表达的目标，或来自邮件、消息、网页与 App 的当前上下文，转化为可审阅、可确认、可执行、可恢复的跨能力任务计划。

> 当前正在从概念原型推进为跨平台内测 MVP。网页 prototype 继续作为交互规格；`apps/mobile` 是独立的 Expo/React Native iOS 与 Android 应用工程，不是 WebView 包装。

面试邀请流程是第一个完整 reference scenario 与内测 release gate，不再是产品边界。通用 kernel 围绕 Goal、Context、Trigger、Plan、Decision、Capability、Confirmation、Receipt 与持续 Task State 构建；新增 dinner、monitoring、travel 或 purchase 场景不应修改 reducer 或 executor。

## 快速入口

| | 地址 |
|---|---|
| **Interactive Demo**(真实 Gemini AI 解析) | [prototype/wireframes-high-fidelity.html](prototype/wireframes-high-fidelity.html) · 线上:https://angel19190828-commits.github.io/ai-native-ios/prototype/wireframes-high-fidelity.html |
| **Case Study** | [prototype/case-study.html](prototype/case-study.html) · 线上:https://angel19190828-commits.github.io/ai-native-ios/prototype/case-study.html |
| Demo Video | 尚未制作 |

## Mobile MVP（开发中）

- 产品范围：[docs/MVP_SCOPE.md](docs/MVP_SCOPE.md)
- 架构决策：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 插件清单 Schema：[docs/plugin-manifest.schema.json](docs/plugin-manifest.schema.json)
- 移动端工程：[apps/mobile](apps/mobile)
- 隐私数据地图：[docs/PRIVACY_DATA_MAP.md](docs/PRIVACY_DATA_MAP.md)
- 内测发布手册：[docs/RELEASE_RUNBOOK.md](docs/RELEASE_RUNBOOK.md)
- 公开页面：[隐私说明](privacy.html) · [内测支持](support.html)

```bash
npm run mobile:start
npm run mobile:android
npm run mobile:test
npm run mobile:typecheck
npm run release:check:static
```

复制 `apps/mobile/.env.example` 为 `apps/mobile/.env.local`，填写 API 地址、Supabase URL 与 publishable key。`EXPO_PUBLIC_*` 会进入 App bundle，因此这里只能放公开配置，不能放 Gemini key、Supabase secret key 或静态生产 token。外部构建必须关闭 `EXPO_PUBLIC_ALLOW_GUEST`。

EAS 构建配置位于 `apps/mobile/eas.json`，区分 development、preview/internal 与 production/store 三个环境。运行云构建前需先关联真实 EAS project，并在对应环境设置 `EXPO_PUBLIC_API_BASE_URL` 与 Supabase 公开配置；发布前检查会拒绝 guest mode、缺少 HTTPS API、账号配置、project ID、隐私政策或支持页面的构建。

GitHub `Mobile CI` 会运行 API/移动端测试、类型检查、静态发布检查、Expo Doctor 与 Android production export。`EAS Internal Build` 仅手动触发；按照 Expo 的 CI 要求，必须先登录并为 iOS、Android 各成功完成一次交互式 EAS build，建立 project ID 与签名凭据。

当前基线为 Expo SDK 57、React Native 0.86 和 TypeScript。iOS 原生构建仍需要 macOS/Xcode 或 EAS Build；App Intents、Share Extension 和需要原生权限的能力必须使用 development build/TestFlight，不能只靠 Expo Go 验证。

移动端使用 Supabase email OTP 登录，刷新会话保存在系统 SecureStore；`POST /api/plan` 和 `POST /api/route` 接收短期 access token，并在服务端验证 JWT。计划由确定性代码生成 Calendar → 通勤 → Reminders 步骤；模型不能直接调用系统能力，也不能自行标记步骤完成。`MOBILE_API_TOKEN` 仅保留为本地开发回退，绝不能编译进 App。

数据库基线位于 `supabase/migrations/202609190001_taskspace_core.sql`，为 tasks、append-only task events 与 devices 启用按 `auth.uid()` 隔离的 Row Level Security。`PUT /api/tasks` 会原子写入任务快照与审计事件，并使用 `syncVersion` 阻止旧设备覆盖新状态；登录后 App 优先恢复服务端最新任务，本地账号级 cache 只作离线回退。部署内测环境后仍须用两个真实测试账号验证跨账号读写被拒绝。

直接用浏览器打开即可,无需安装、无需构建。本地打开时"AI 分析"功能需要额外起一个本地代理(见下方「本地运行」),线上版本已经连了部署好的后端,可以直接粘贴任意邮件文本试真实解析。

## 关键功能

- **粘贴任意邀请/通知文本 → 真实 Gemini 解析**:自动判断这是 appointment(需到场活动)、meeting(线上会议)还是 deadline(截止日期),提取标题、时间、地点/会议链接、到达要求、准备事项
- **按分类结果切换界面与流程**:三种 kind 对应不同的建议卡片、最终计划卡片、任务卡片、当天视图内容——不是同一套 UI 硬套三种文案
- **灵动岛承载后台进度**:AI 规划中只在需要用户判断时才展开面板,其余时间收进灵动岛,不打断当前操作
- **内联编辑 + 用户决定范围**:日期、时间、地点可直接在原地修改;AI 提出日历/通勤/提醒三类建议,用户逐项决定保留或跳过
- **冲突处理与撤销**:日程冲突时暂停并给出三个方案(保留/联系对方改期/稍后处理),任意已执行操作都可以撤销
- **AI 服务不可用时的诚实降级**:请求失败/超时不会静默套用猜测结果,而是明确提示失败,用户可以重试或主动选择预置案例继续体验,页面会持续显示"演示数据"标记

## AI 集成

真实调用 Google **Gemini**(`gemini-flash-latest`),结构化输出(`responseSchema`)返回:

```json
{
  "eventTitle": "...",
  "kind": "appointment | meeting | deadline",
  "dateTime": "...",
  "location": "...",
  "arrival": "...",
  "preparation": "..."
}
```

Gemini 只负责**理解和分类**输入文本;分类结果之后的所有状态流转、冲突判断、执行动作都由前端的确定性状态机(`prototype/wireframes-high-fidelity.html` 内联脚本)控制,AI 不直接执行任何操作。

## 产品架构

```
GitHub Pages(静态前端: demo + case study)
        │  POST /extract { emailText }
        ▼
Vercel Serverless Function(api/extract.js)
        │  GEMINI_API_KEY 只存在于 Vercel 环境变量
        ▼
Google Gemini API
```

前端从不直接持有或调用 Gemini key;所有请求经过 `api/extract.js` 转发,CORS 通过 `ALLOWED_ORIGIN` 环境变量锁定只允许指定的前端来源调用。

## Demo Mode 与 Local AI Mode

| | Demo Mode(默认,线上版本) | Local AI Mode(本地开发) |
|---|---|---|
| 请求地址 | `wireframes-high-fidelity.html` 顶部 `API_BASE` 指向部署好的 Vercel 函数 | 指向 `http://localhost:8787`(`prototype/ai-proxy.js`) |
| Key 从哪来 | Vercel 项目环境变量 | 你自己电脑上的环境变量,启动代理时传入 |
| 失败时怎么办 | 显示失败提示,用户主动选择预置案例(面试/线上会议/截止日期),并持续显示"演示数据"标记 | 同上 |

## 本地运行

不需要任何构建工具,直接用浏览器打开 `prototype/wireframes-high-fidelity.html` 即可看到界面和全部状态流转。要让"AI 分析"输入框跑真实 Gemini 解析,需要额外起本地代理:

```bash
# 1. 复制环境变量示例,填入你自己的 key
cp .env.example .env
# 编辑 .env,把 GEMINI_API_KEY=your_key_here 换成真实 key

# 2. 启动本地代理(读取 GEMINI_API_KEY 环境变量)
GEMINI_API_KEY=你的key node prototype/ai-proxy.js
# 代理跑在 http://localhost:8787

# 3. 把 wireframes-high-fidelity.html 顶部的 API_BASE 临时改成 http://localhost:8787
#    (线上部署时应改回 Vercel 地址,不要把这一步的改动提交)
```

`.env.example`:
```
GEMINI_API_KEY=your_key_here
ALLOWED_ORIGIN=https://angel19190828-commits.github.io
```

`.env` 已在 `.gitignore` 中,不会被提交。**任何时候都不要把真实 key 写进代码或提交到仓库。**

## 技术栈

- 纯 HTML + CSS + 原生 JavaScript,无前端框架、无构建步骤
- 网页原型仍使用 `api/extract.js`；移动端使用具备输入限制、认证门槛、超时和响应校验的 `api/plan.js`
- 已有 Supabase 账户与数据库/RLS 基线；生产项目迁移、双账号隔离验证、账号删除与保留策略仍是外部内测前的发布门槛
- Google Gemini API(`gemini-flash-latest`),结构化输出
- 部署:GitHub Pages(静态前端)+ Vercel(API 代理)

## 项目结构

```
ai-native-ios/
├── README.md                          本文件
├── PROGRESS.md / PROTOTYPE-CHANGELOG.md   阶段进度与高保真迭代记录
├── api/
│   └── extract.js                     Vercel serverless function,Gemini 代理
├── apps/mobile/                        Expo/React Native 跨平台 MVP 工程
├── docs/                               MVP 范围、架构与插件协议
├── research/                          研究阶段产出(七类系统入口审查、任务分析、研究发现等)
├── design/                            信息架构、状态机、用户流程、验证计划
├── slides/                            案例研究幻灯片(无内嵌图片)
└── prototype/
    ├── wireframes-high-fidelity.html  ★ 当前主线 Demo(真实 AI 集成)
    ├── ai-proxy.js                    本地开发用的 Gemini 代理(Local AI Mode)
    ├── case-study.html                案例研究展示页
    ├── app.html / wireframes.html     早期迭代版本(静态模拟数据,无真实 AI),保留作研究过程留痕
    ├── assets/                        图标、截图、研究证据(已脱敏)
    ├── css/                           tokens.css(设计变量)+ app.css + wireframes.css + case-study.css
    └── js/                            app.html 对应的状态机与渲染逻辑(data.js / app.js)
```

## 已知假设与简化(供评审参考)

- **日期基准**:邮件"下周二"按发送日期推算为具体日期;原型同时保留一个"本周二"选项,用于演示信息不确定时的确认交互。
- **执行进度是脚本化的确定性演示**,不是真实异步调用,用于保证评审时每次都能看到完整的状态分支(完成/失败/等待确认/已撤销)。
- **"打开日历/查看路线/查看文件"**为模拟预览,不是真实 App 跳转。
- **AI 只负责理解与分类**,不负责决定最终执行内容——这是有意的设计边界,不是技术限制。

## 已知限制 / 尚未完成

- Demo Video 尚未制作
- API 后端(`api/extract.js`)刚完成本地测试,线上 Vercel 部署仍在配置中
- 早期版本(`app.html`/`wireframes.html`)与当前高保真版本的视觉/交互不完全一致,仅作研究过程留痕保留
- 未执行正式用户测试(见 [design/validation-plan.md](design/validation-plan.md)),现有 4 位用户的可用性测试证据已脱敏后保留在 `prototype/assets/research-evidence/`

## 未来方向

Email 目前只是验证场景,不是产品唯一入口。核心扩展方向是从"理解一封邮件"发展为"从多个系统来源理解用户目标":Messages 中的约会/截止日期、Safari 中的活动/预订/申请截止时间、Screenshots 中的日期/地点/行动要求、Files/PDF 中的申请材料与到期事项、Calendar 中的准备需求与潜在冲突,以及用户直接用自然语言创建目标。

## 证据分级(贯穿全部文档)

- **苹果官方事实**:标注 [1][2][3][4],指向 Apple Developer / Apple Support / Apple Newsroom,见 [research/06-references.md](research/06-references.md)。
- **本项目分析**:标注"本项目功能审查"或"本项目任务流程审查结果",指本项目自行拆解、计数得出的数据,不代表苹果官方统计。
- **设计推论**:标注"设计推论 / 待验证",指基于研究做出的、尚未经用户测试验证的判断,完整清单见 [design/validation-plan.md](design/validation-plan.md)。

## 交付物对照表

| 交付物 | 位置 |
|---|---|
| Interactive Demo | [prototype/wireframes-high-fidelity.html](prototype/wireframes-high-fidelity.html) |
| Case Study | [prototype/case-study.html](prototype/case-study.html) |
| 系统功能审查表 | [research/01-system-audit.md](research/01-system-audit.md) §1.2 |
| 典型任务分析 | [research/02-task-analysis.md](research/02-task-analysis.md) |
| 研究发现 | [research/03-findings.md](research/03-findings.md) |
| 机会方向评估矩阵 | [research/04-opportunity-matrix.md](research/04-opportunity-matrix.md) |
| 最终设计范围 | [research/05-scope.md](research/05-scope.md) |
| 信息架构 | [design/information-architecture.md](design/information-architecture.md) |
| 完整用户流程(A–E) | [design/user-flows.md](design/user-flows.md) |
| 状态模型 / 风险分级规则 | [design/state-model.md](design/state-model.md) |
| 12 个低保真线框图 | [prototype/wireframes.html](prototype/wireframes.html) |
| 早期高保真原型(静态模拟数据) | [prototype/app.html](prototype/app.html) |
| 用户测试计划 | [design/validation-plan.md](design/validation-plan.md) |
| 完整参考资料 | [research/06-references.md](research/06-references.md) |

## 状态

见 [PROGRESS.md](PROGRESS.md)(研究/设计阶段)与 [PROTOTYPE-CHANGELOG.md](PROTOTYPE-CHANGELOG.md)(高保真原型 + AI 集成迭代记录)。
