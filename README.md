# 目标任务空间 · AI 原生 iOS 概念设计

一个概念设计项目:探索当 AI 成为 iOS 的系统基础能力后,系统如何把用户当前看到的信息或表达的目标,转化为清晰、可执行、可追踪的跨应用任务计划。

场景:用户收到一封线下面试邀请邮件,系统识别其中的时间、地点、联系人和准备要求,生成一个可查看、可修改、可执行、可撤销的任务计划,横跨日历、地图、提醒事项、文件与信息 App。

## 如何查看

直接用浏览器打开(无需安装、无需构建、不需要联网):

- **[prototype/case-study.html](prototype/case-study.html)** —— 从这里开始。完整案例研究页(研究背景 → 研究发现 → 设计范围 → 信息架构 → 用户流程 → 线框图 → 高保真界面,并内嵌可交互原型)。
- **[prototype/app.html](prototype/app.html)** —— 独立打开的完整可交互原型(手机框 + 左侧演示控制面板,可直接跳转到任一流程分支)。
- **[prototype/wireframes.html](prototype/wireframes.html)** —— 12 屏低保真线框图。

```bash
# 无需任何命令,直接双击或用浏览器打开:
prototype/case-study.html
```

## 项目结构

```
ai-native-ios/
├── README.md                          本文件
├── PROGRESS.md                        阶段进度记录
├── research/                          研究阶段产出
│   ├── 01-system-audit.md             iOS 系统功能审查(七类入口 + App Intents)
│   ├── 02-task-analysis.md            典型任务分析(面试邀请场景,17 步拆解)
│   ├── 03-findings.md                 四条研究发现
│   ├── 04-opportunity-matrix.md       五个机会方向的评估矩阵
│   ├── 05-scope.md                    最终设计范围与设计问题
│   └── 06-references.md               引用规范与证据分级
├── design/                            体验架构
│   ├── information-architecture.md    "目标任务空间"数据模型与信息架构
│   ├── state-model.md                 屏幕状态机与风险→确认方式映射
│   ├── user-flows.md                  流程 A–E 完整步骤
│   └── validation-plan.md             未来用户测试计划(未执行,无伪造结果)
└── prototype/                         可运行网页原型
    ├── case-study.html                案例研究展示页(23 节结构)
    ├── wireframes.html                低保真线框图(12 屏)
    ├── app.html                       高保真可交互原型(手机框)
    ├── css/                           tokens.css(设计变量) + app.css + wireframes.css + case-study.css
    └── js/
        ├── data.js                    模拟数据(邮件、联系人、候选文件、初始任务状态)
        └── app.js                     状态机与全部屏幕渲染逻辑
```

## 技术方案

纯 HTML + CSS + 原生 JavaScript,无构建步骤、无依赖、无后端、不连接任何真实 Apple API。全部数据来自 `prototype/js/data.js` 的本地模拟数据。状态由 `prototype/js/app.js` 中的单一 `state` 对象驱动,所有屏幕都是从同一个任务数据模型派生的渲染函数,而不是相互独立写死的页面。

## 已知假设与简化(供评审参考)

- **日期基准**:邮件"下周二"按发送日期(2026-07-27,周一)推算为 2026-08-04;原型同时保留一个"本周二"选项,用于演示流程 C(信息不确定的确认交互)。
- **任务计划的"增加步骤"**:交互要求明确写的是删除与重排,原型未实现自由添加全新步骤,而是通过"撤销删除"覆盖增加步骤的场景(已删除的步骤可随时恢复)。
- **系统级持续状态**(锁屏/小组件/通知/Siri):按项目要求做成一个统一的静态对比面板,展示同一任务状态如何在四处呈现不同粒度,而不是为每处重复实现一整套可操作界面。
- **执行进度是脚本化的确定性演示**,不是真实异步调用:点击"推进下一步"会按固定顺序解析每个步骤(其中「检查日历冲突」固定触发冲突分支,「查找作品集」固定触发失败分支),用于保证评审时每次都能看到完整的四种状态(完成/失败/等待确认/已撤销)。
- **完成页的"打开日历/查看路线/查看文件"**为模拟预览弹层,不是真实 App 跳转,已在原型内标注"此预览为原型模拟界面"。

## 证据分级(贯穿全部文档)

- **苹果官方事实**:标注 [1][2][3][4],指向 Apple Developer / Apple Support / Apple Newsroom,见 [research/06-references.md](research/06-references.md)。
- **本项目分析**:标注"本项目功能审查"或"本项目任务流程审查结果",指本项目自行拆解、计数得出的数据,不代表苹果官方统计。
- **设计推论**:标注"设计推论 / 待验证",指基于研究做出的、尚未经用户测试验证的判断,完整清单见 [design/validation-plan.md](design/validation-plan.md)。

## 交付物对照表

| 交付物 | 位置 |
|---|---|
| 案例研究网页 | [prototype/case-study.html](prototype/case-study.html) |
| 系统功能审查表 | [research/01-system-audit.md](research/01-system-audit.md) §1.2 |
| 典型任务分析 | [research/02-task-analysis.md](research/02-task-analysis.md) |
| 当前任务流程图 + 量化审查结果 | [research/02-task-analysis.md](research/02-task-analysis.md) §2.2–2.3 |
| 研究发现 | [research/03-findings.md](research/03-findings.md) |
| 机会方向评估矩阵 | [research/04-opportunity-matrix.md](research/04-opportunity-matrix.md) |
| 最终设计范围 | [research/05-scope.md](research/05-scope.md) |
| 信息架构 | [design/information-architecture.md](design/information-architecture.md) |
| 完整用户流程(A–E) | [design/user-flows.md](design/user-flows.md) |
| 状态模型 / 风险分级规则 | [design/state-model.md](design/state-model.md) |
| 12 个低保真线框图 | [prototype/wireframes.html](prototype/wireframes.html) |
| 高保真界面 + 可点击网页原型 | [prototype/app.html](prototype/app.html) |
| 冲突 / 失败 / 修改 / 撤销状态 | app.html 内流程 B / D / E(见左侧控制面板快捷入口) |
| 系统级持续状态展示 | app.html 内"系统级持续状态"屏幕 |
| 用户测试计划 | [design/validation-plan.md](design/validation-plan.md) |
| 完整参考资料 | [research/06-references.md](research/06-references.md) |

## 状态

全部阶段已完成并在浏览器中验证(见 [PROGRESS.md](PROGRESS.md))。
