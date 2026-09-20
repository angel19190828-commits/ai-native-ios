internal import ExpoModulesCore
import Foundation

struct TaskspaceIntentInvocation: Codable, Sendable {
  let id: String
  let name: String
  let params: [String: String]
  let createdAt: Double
}

actor TaskspaceIntentStore {
  static let shared = TaskspaceIntentStore()
  private let defaults = UserDefaults.standard
  private let key = "taskspace.pendingAppIntents.v1"

  func enqueue(name: String, params: [String: String] = [:]) {
    var pending = load()
    pending.append(TaskspaceIntentInvocation(
      id: UUID().uuidString,
      name: name,
      params: params,
      createdAt: Date().timeIntervalSince1970 * 1000
    ))
    if pending.count > 100 { pending.removeFirst(pending.count - 100) }
    if let encoded = try? JSONEncoder().encode(pending) { defaults.set(encoded, forKey: key) }
  }

  func consume() -> [String] {
    let pending = load()
    defaults.removeObject(forKey: key)
    return pending.compactMap { invocation in
      guard let data = try? JSONEncoder().encode(invocation) else { return nil }
      return String(data: data, encoding: .utf8)
    }
  }

  private func load() -> [TaskspaceIntentInvocation] {
    guard let data = defaults.data(forKey: key) else { return [] }
    return (try? JSONDecoder().decode([TaskspaceIntentInvocation].self, from: data)) ?? []
  }
}

final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("TaskspaceAppIntents")
    AsyncFunction("consumePendingInvocationsAsync") { () async -> [String] in
      await TaskspaceIntentStore.shared.consume()
    }
  }
}
