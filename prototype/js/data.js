// 模拟数据 —— 全部为本项目虚构内容,不连接任何真实 Apple API 或真实用户数据。

const EMAIL = {
  from: "Alex Chen",
  fromSub: "alex.chen@brightpath-design.com",
  subject: "面试邀请:Product Designer 岗位",
  receivedAt: "2026-07-27 09:14",
  bodyLines: [
    "You will attend an in-person interview next Tuesday at 10:30 a.m.",
    "The address is 555 Burrard Street.",
    "Please arrive 15 minutes early and bring your portfolio.",
    "If you need to reschedule, please contact Alex."
  ]
};

// 以邮件发送日期(周一, 2026-07-27)为基准推算"下周二"
const RESOLVED_DATE_PRIMARY = { label: "2026年8月4日 周二", iso: "2026-08-04" };
const RESOLVED_DATE_ALT = { label: "2026年7月28日 周二(本周)", iso: "2026-07-28" };

const EXISTING_EVENT = {
  title: "设计评审会议",
  time: "2026年8月4日 10:00–11:00",
  calendar: "工作日历"
};

const PORTFOLIO_CANDIDATES = [
  { id: "f1", name: "Portfolio_2026_Final_v3.pdf", location: "文件 App / 我的 iPhone / 求职资料", modified: "2026-07-20", recommended: true },
  { id: "f2", name: "Portfolio_draft_old.pdf", location: "文件 App / iCloud Drive / 归档", modified: "2025-11-02", recommended: false },
  { id: "f3", name: "作品集截图合集.key", location: "文件 App / 我的 iPhone / 求职资料", modified: "2026-06-11", recommended: false }
];

const MESSAGE_DRAFT_TEMPLATE = "Hi Alex, 感谢邀请!我在下周二 10:30 这个时间段与另一场会议冲突,方便的话能否协调到当天下午,或改到周三上午?谢谢!";

function buildInitialTask() {
  return {
    goal: "帮我准备这次面试",
    sourceEmail: EMAIL,
    extractedInfo: [
      { id: "eventType", label: "事件类型", value: "线下面试", source: "来自 Alex 的邮件正文", confidence: "certain", editable: false },
      { id: "date", label: "面试日期", value: RESOLVED_DATE_PRIMARY.label, source: "来自 Alex 的邮件:“next Tuesday”(系统按邮件发送日期推算)", confidence: "ambiguous", editable: true, options: [RESOLVED_DATE_PRIMARY, RESOLVED_DATE_ALT] },
      { id: "time", label: "面试时间", value: "上午 10:30", source: "来自 Alex 的邮件正文", confidence: "certain", editable: true },
      { id: "address", label: "地点", value: "555 Burrard Street", source: "来自 Alex 的邮件正文", confidence: "certain", editable: true },
      { id: "arriveEarly", label: "建议提前到达", value: "15 分钟", source: "来自 Alex 的邮件正文", confidence: "certain", editable: true },
      { id: "materials", label: "需携带材料", value: "作品集", source: "来自 Alex 的邮件正文", confidence: "certain", editable: false },
      { id: "contact", label: "联系人", value: "Alex Chen · alex.chen@brightpath-design.com", source: "来自邮件发件人信息", confidence: "certain", editable: false }
    ],
    dateResolved: false,
    steps: [
      {
        id: "check_conflict",
        title: "检查日历冲突",
        app: "日历",
        source: "依据:面试日期与时间",
        risk: "low",
        needsConfirmation: false,
        status: "pending",
        resultText: ""
      },
      {
        id: "create_event",
        title: "创建面试日历事件",
        app: "日历",
        source: "依据:面试日期、时间、地点",
        risk: "medium",
        needsConfirmation: true,
        status: "pending",
        resultText: ""
      },
      {
        id: "check_route",
        title: "查看路线与交通时间",
        app: "地图",
        source: "依据:地点(555 Burrard Street)",
        risk: "low",
        needsConfirmation: false,
        status: "pending",
        resultText: ""
      },
      {
        id: "set_departure_reminder",
        title: "设置建议出发时间提醒",
        app: "提醒事项",
        source: "依据:路线用时 + 提前 15 分钟",
        risk: "medium",
        needsConfirmation: true,
        status: "pending",
        resultText: ""
      },
      {
        id: "find_portfolio",
        title: "查找作品集文件",
        app: "文件",
        source: "依据:“请携带作品集”",
        risk: "low",
        needsConfirmation: false,
        status: "pending",
        resultText: ""
      },
      {
        id: "set_prep_reminder",
        title: "设置准备提醒(打包作品集)",
        app: "提醒事项",
        source: "依据:所需材料 + 面试日期",
        risk: "medium",
        needsConfirmation: true,
        status: "pending",
        resultText: ""
      }
    ],
    conflict: null,       // 运行时填充
    messageDraft: null,   // 运行时填充
    selectedPortfolio: null,
    removedStepIds: []
  };
}

function computeOverallStatus(task) {
  const active = task.steps.filter(s => !task.removedStepIds.includes(s.id));
  if (active.every(s => s.status === "pending")) return "待处理";
  if (active.some(s => s.status === "waiting_confirmation")) return "等待确认";
  if (active.some(s => s.status === "failed")) return "部分失败";
  if (active.every(s => s.status === "done" || s.status === "cancelled" || s.status === "skipped")) return "已完成";
  return "正在进行";
}

const STATUS_TEXT = {
  pending: "待处理",
  preparing: "正在准备",
  waiting_confirmation: "等待确认",
  done: "已完成",
  failed: "失败",
  cancelled: "已撤销",
  skipped: "已跳过"
};
