# 状态模型(供原型实现参照)

## 屏幕状态机(screen)

```
mail
  → suggestion_overlay
      → extracting (短暂中间态)
        → info_confirm            (流程 C 的日期确认发生在此屏)
          → plan_generated
            → batch_confirm
              → executing
                  → conflict (流程 B,若命中冲突)
                      → message_draft
                        → executing (继续)
                  → file_finder (流程 D,若作品集步骤失败后用户选择"手动选择文件")
                  → failure_recovery (流程 D,失败卡片)
                → complete
                    → undo_confirm (流程 E)
```

## 步骤状态(step.status)

`pending → preparing → waiting_confirmation → done`
`preparing → failed → (重试 preparing | 手动处理 done | 跳过 skipped)`
`done → cancelled`(仅限撤销)

## 整体任务状态(task.overallStatus)

由 `steps[]` 派生,不单独手动设置:

- 存在 `waiting_confirmation` → **等待确认**
- 存在 `failed` 且未被跳过/处理 → **部分失败**
- 全部 `done` 或 `skipped`/`cancelled`(且至少一个 done)→ **已完成**
- 存在 `preparing` → **正在进行**
- 全部 `pending` → **待处理**

## 风险 → 确认方式映射(固定规则,不由内容动态改变)

```js
risk === 'low'    → 自动准备结果,不需要确认
risk === 'medium' → 可在 batch_confirm 页与其他中风险步骤一起确认
risk === 'high'   → 必须进入独立确认屏(message_draft 等),不会出现在批量确认列表里
```

此映射直接来自 [设计原则 §5](../research/05-scope.md#56-ai-原生任务系统-vs-快捷指令设计边界声明) 与项目要求"不同风险等级采用不同确认方式",是原型 `js/app.js` 中 `canBatchConfirm(step)` 函数的实现依据。
