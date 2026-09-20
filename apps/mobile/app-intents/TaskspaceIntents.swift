import AppIntents

struct CreateTaskFromTextIntent: AppIntent {
  static let title: LocalizedStringResource = "Create Task from Text"
  static let description = IntentDescription("Start a reviewable Taskspace plan from text.")
  static let openAppWhenRun = true

  @Parameter(title: "Task request", requestValueDialog: "What should Taskspace help you accomplish?")
  var request: String

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await TaskspaceIntentStore.shared.enqueue(name: "createTask", params: ["request": request])
    return .result(dialog: "Taskspace opened a draft for review.")
  }
}

struct ShowPendingDecisionIntent: AppIntent {
  static let title: LocalizedStringResource = "Show Pending Decision"
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await TaskspaceIntentStore.shared.enqueue(name: "showPendingDecision")
    return .result(dialog: "Opening the decision that needs your attention.")
  }
}

struct ContinueTaskIntent: AppIntent {
  static let title: LocalizedStringResource = "Continue Task"
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await TaskspaceIntentStore.shared.enqueue(name: "continueTask")
    return .result(dialog: "Opening your latest task.")
  }
}

struct RequestStopTaskIntent: AppIntent {
  static let title: LocalizedStringResource = "Stop Task"
  static let description = IntentDescription("Open Taskspace to review and confirm stopping remaining actions.")
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await TaskspaceIntentStore.shared.enqueue(name: "requestStopTask")
    return .result(dialog: "Open Taskspace to confirm which remaining actions to stop.")
  }
}
