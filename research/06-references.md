# 06 · 参考资料

## 证据分级说明

本项目区分三类信息,避免混淆:

1. **苹果官方事实** —— 标注 [数字],指向官方文档、支持页面或新闻稿。
2. **本项目分析** —— 标注"本项目任务流程审查结果"或"本项目功能审查",指本项目自行执行、记录并整理的数据,不代表苹果官方统计。
3. **设计推论** —— 标注"设计假设 / 待验证",指基于研究做出的推测性判断,尚未经过用户测试验证。

## 苹果官方资料

| 编号 | 名称 | 机构 | 用途 | 链接 | 访问日期 |
|------|------|------|------|------|----------|
| [1] | App Intents \| Apple Developer Documentation | Apple Inc. | App Intents 如何让第三方 App 内容/操作被 Siri、Spotlight、Shortcuts、Widgets、控制中心、操作按钮调用 | https://developer.apple.com/documentation/appintents | 2026-07-29 |
| [1b] | Adopting App Intents to support system experiences | Apple Inc. | App Intents 支持的具体系统体验列表 | https://developer.apple.com/documentation/AppIntents/adopting-app-intents-to-support-system-experiences | 2026-07-29 |
| [2] | Shortcuts at a glance / Intro to Shortcuts — Apple Support | Apple Inc. | 快捷指令由"动作"组成,动作顺序决定自动化行为;支持条件触发的个人与家庭自动化 | https://support.apple.com/guide/shortcuts/shortcuts-at-a-glance-apdf22b0444c/ios | 2026-07-29 |
| [3] | Explore Live Activities and the Dynamic Island — Apple Developer | Apple Inc. | 实时活动在锁屏/灵动岛展示进行中事件的实时数据,可通过 APNs 远程更新 | https://developer.apple.com/news/?id=bkm73839 | 2026-07-29 |
| [4] | Apple introduces Siri AI, a profoundly more capable and personal assistant | Apple Inc. Newsroom | 新一代 Siri 的个人上下文与屏幕感知能力说明 | https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/ | 2026-07-29 |

## 本项目产生的分析(非苹果官方数据)

| 名称 | 说明 | 文件 |
|------|------|------|
| 七类任务入口分类 | 本项目为便于分析而建立的功能分组,非苹果官方分类 | [01-system-audit.md](01-system-audit.md) |
| 当前 iOS 任务流程审查(17 步 / 6 个 App / 7 次切换) | 本项目对"面试邀请邮件"场景的实际步骤拆解与计数 | [02-task-analysis.md](02-task-analysis.md) |
| 机会方向评估矩阵打分 | 本项目对五个方向按八个维度的相对评分,用于说明范围收敛过程,非用户调研结果 | [04-opportunity-matrix.md](04-opportunity-matrix.md) |

## 尚待验证的设计推论

以下判断目前基于本项目的系统审查与设计推理,**尚未经过用户测试**,已在 [验证计划](../design/validation-plan.md) 中列出:

- 用户能否理解系统生成的任务计划
- 用户能否发现 AI 提取错误
- 用户是否信任批量确认
- 用户是否认为该系统比手动切换 App 更简单
- 用户是否会觉得系统"过于主动"

## 禁止使用的证据类型(本项目自律声明)

本项目不引用无来源博客、营销软文、无法确认日期的二手总结,不编造用户比例、使用概率或"大多数用户认为"一类无数据支持的表述。
