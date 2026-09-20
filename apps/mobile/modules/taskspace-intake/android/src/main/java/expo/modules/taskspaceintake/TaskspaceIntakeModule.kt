package expo.modules.taskspaceintake

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TaskspaceIntakeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TaskspaceIntake")

    AsyncFunction("consumeSharedTextAsync") {
      val intent = appContext.currentActivity?.intent
      if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") {
        return@AsyncFunction null
      }
      val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()?.takeIf { it.isNotEmpty() }
      intent.removeExtra(Intent.EXTRA_TEXT)
      text
    }
  }
}
