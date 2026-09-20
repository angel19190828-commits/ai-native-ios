import AppIntents

struct AppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: CreateTaskFromTextIntent(),
      phrases: ["Create a task in \(.applicationName)", "用 \(.applicationName) 创建任务"],
      shortTitle: "Create Task",
      systemImageName: "sparkles"
    )
    AppShortcut(
      intent: ShowPendingDecisionIntent(),
      phrases: ["Show my pending decision in \(.applicationName)", "在 \(.applicationName) 查看待决定事项"],
      shortTitle: "Pending Decision",
      systemImageName: "questionmark.circle"
    )
    AppShortcut(
      intent: ContinueTaskIntent(),
      phrases: ["Continue my task in \(.applicationName)", "在 \(.applicationName) 继续任务"],
      shortTitle: "Continue Task",
      systemImageName: "play.circle"
    )
    AppShortcut(
      intent: RequestStopTaskIntent(),
      phrases: ["Stop my task in \(.applicationName)", "在 \(.applicationName) 停止任务"],
      shortTitle: "Stop Task",
      systemImageName: "stop.circle"
    )
  }
}
