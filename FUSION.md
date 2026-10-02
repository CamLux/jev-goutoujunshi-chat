# 融合说明：jev-chat-jarvis × 狗头军师 Jev Chat

本文记录这次融合做了什么、为什么这么做、验证到了什么程度，以及**哪些没有验证**。

---

## 一、先明确一件事：这不是两个项目的融合

`goutoujunshi-jev-chat/integrations/jev_android` 是 `jev-chat-jarvis` 的 **fork**——同一个
`com.jev.probe` 命名空间、同样的包结构与文件名。所以本次工作是**合并两个分支**，而不是拼接
两套架构。

| 源 | commit | 作用 |
|---|---|---|
| `jev-chat/jev-chat-jarvis` | `1af6f3d` | **融合基座** |
| `shengjidaguai-china/goutoujunshi-jev-chat` | `d19fd84` | 能力来源 |

**为什么以 jarvis 为基座**：它保有 `ConversationSession` 与 `GuardedInputWriter` 两个安全子系统，
而 goutoujunshi 的 Android 分支里这两个文件**不存在**（`grep ConversationSession` 无结果）。
反过来移植这两块的成本高于正向移植 goutoujunshi 的 5 个模块。

---

## 二、融合后的能力清单（并集，无舍弃）

### 来自 goutoujunshi（新增 5 个文件 + 4 处扩展）

| 文件/改动 | 作用 |
|---|---|
| `core/GoutouGuidance.kt` | 证据优先规则；`explicitBoundary()` 识别明确拒绝；起草规则与停止条件 |
| `core/RouteKeys.kt` | **密钥同源校验**：只有 scheme/host/port 全同才复用密钥，杜绝把 OpenRouter key 发到别家主机 |
| `core/TrendData.kt` | 关系趋势 K 线：5 种示例走势 + CSV 导入（`timestamp,sender,message`），方向净差 |
| `jev/DeepSeekStrategyClient.kt` | 独立 DeepSeek 七策略判断，含 logprobs 权重与三次投票稳定性校验 |
| `KlineActivity.kt` | K 线窗口（已注册进 AndroidManifest） |
| `core/ChatModels.kt` | `Analysis` 增加 `strategy` / `strategyWeights` / `strategyMethod` / `facts` / `unknowns` |
| `core/Prefs.kt` | `strategyProvider` / `strategyModel` / `strategyKey` + `effectiveStrategyKey()` |
| `jev/ReplyClient.kt` | 狗头军师起草规则、`judgment` 引导起草、`details` / `explain` / `rewrite` |
| `jev/JevClient.kt` | 策略分流：`strategyProvider == "deepseek"` 时走独立策略，否则走 Jev |

### 来自 jarvis（基座保留）

- `ConversationSession` —— 会话归属与 revision token，防止切换会话后旧结果覆盖新会话
- `GuardedInputWriter` —— 填入时序兜底：150ms 读回 → 聚焦重试 → 清空粘贴，三步确认
- `HttpJson` 的**取消支持**（`Thread.currentThread().isInterrupted`）——goutoujunshi 分支删掉了这段，
  融合时保留 jarvis 版本；否则切换会话时在途请求无法中断
- `QQAdapter` / `XAdapter` / `FeishuAdapter`
- `KnowledgeActivity` 与知识库全链路

### 填入路径：两道防线叠加（强于任一边）

两个项目**各自都有**收件人校验，只是机制不同。融合后两道都在：

```
GuardedInputWriter.fill(text)
  └─ resolve() 每次调用都重新验证：
       ├─ ConversationSession token 仍有效（jarvis 的时序防线）
       ├─ 重新 extract() 快照，title + signature 必须一致（goutoujunshi 的重比对）
       └─ 输入框非空时拒绝写入，只复制到剪贴板（goutoujunshi 的「不覆盖已有草稿」）
```

要点：**填错窗口填不进去，有草稿也不会被清掉。**

---

## 三、微信适配（本次核心）

### 3.1 上游为什么下线微信

源码注释原文（`ChatCaptureService.kt`）：

> reading it (node tree / screenshot / OCR) is what trips WeChat's anti-screenshot risk control

`README.md` 亦称「微信 Android 版已全面下架」。**关键在 screenshot/OCR**，不在节点树本身。

### 3.2 本次采用的路线：纯节点树，锁 <8.0.52

- 微信 **8.0.52 起**对无障碍服务隐藏节点文本
- **8.0.52 以下**节点文本可读 → 采集只需遍历节点树，**完全不截屏**
- 不截屏 → 绕开上游踩的那个风控点

这与上游的取舍方向一致，只是把版本前提显式化了。

### 3.3 六处改动

| # | 位置 | 改动 |
|---|---|---|
| 1 | `adapters` 注册表 | 加入 `WeChatAdapter()` |
| 2 | `targetFor()` | 移除 `pkg == PKG_WECHAT` 排除 |
| 3 | `onAccessibilityEvent()` | 删除「遇到微信就提示」短路 |
| 4 | `maybeCapture()` | 删除短路；**在空快照分支对微信强制排除自动 OCR** |
| 5 | `ocrCaptureManual()` | **保留**手动「截屏识别一次」（见 3.5） |
| 6 | 常量与提示 | `WECHAT_DISABLED_MSG` → `WECHAT_UNSUPPORTED_MSG`（改为版本提示） |

### 3.4 多版本资源 id（"低版本可用"的落点）

`id/bkl` 是混淆后的资源名，不同构建会变。改造为**候选表 + 命中缓存**：

```kotlin
private val BUBBLE_ID_CANDIDATES = linkedSetOf(
    "com.tencent.mm:id/bkl",   // 已验证
    "com.tencent.mm:id/bkk", "com.tencent.mm:id/bkj",
    "com.tencent.mm:id/bki", "com.tencent.mm:id/bkh"
)
```

首次命中后写入 `resolvedBubbleId`，之后每个节点只做一次字符串比较——**不再每帧全表扫描**。

若你的微信版本用的是别的 id：

```bash
adb shell uiautomator dump && grep -o 'com.tencent.mm:id/[a-z]*'
```

把气泡容器的 id 加进候选表即可，无需改逻辑。

### 3.5 版本不匹配时的行为

节点树读不到文本（>= 8.0.52）时：

1. 适配器按契约返回**空 messages 快照**（= "在聊天窗但读不到正文"）
2. 服务识别到 `pkg == PKG_WECHAT` → **不截屏**，toast 提示一次
   （`这个微信版本的聊天内容读不到；8.0.52 以下可用，或用菜单里的「截屏识别一次」`）
3. 用户仍可**主动**点「截屏识别一次」走手动 OCR —— 风险由用户自己选择承担

自动链路**永不**在微信内截图。

### 3.6 设置开关：微信分析（opt-in，默认关）

设置页 → 「微信分析（仅 8.0.52 以下可用）」，对应 `Prefs.wechatEnabled`。

**为什么是独立开关，而不是并入 `enabled` 总开关**：读微信意味着依赖一个特定的版本区间
（<8.0.52）且依赖微信不把这次读取判为异常。上游正是踩了这个风控才整体下线微信。
让用户通过总开关"顺带"继承这个取舍是不合适的，必须显式选择。

**三道闸门**（全部以 `pkg == PKG_WECHAT && !prefs.wechatEnabled` 判定）：

| 位置 | 作用 |
|---|---|
| `targetFor()` | 所有读取路径的唯一漏斗；关闭时**根本不调用** `adapter.extract()` |
| `maybeCapture()` | 该方法直接调 `extract()`，不经过 `targetFor`，故需单独设闸 |
| `ocrCaptureManual()` | 手动「截屏识别一次」同样受开关约束；关闭时提示去设置里打开 |

关键点：关闭时是**不读取**，而不是"读取后丢弃"——`targetFor` 的闸门放在 `adapters[pkg]`
查找之前。

开关关闭时的界面文案：

> 默认关闭。开启后只读微信的界面节点文字，不截屏、不上传。
> 微信 8.0.52 起会隐藏节点文字，这个版本及以上读不到内容，只会提示一次。
> 读取微信仍可能被腾讯判定为异常行为，风险自负；请只在自己有权查看的会话上使用。

设置变更**即时生效**：`ChatCaptureService` 的 `OnSharedPreferenceChangeListener` 监听
`wechat_enabled` 与 `wechat_auto_analyze`，关闭时立刻丢弃当前会话并隐藏悬浮窗，不必等下一个事件。

### 3.7 微信自动分析：独立的第二个开关

设置页 → 「微信：对方发消息时自动分析」，对应 `Prefs.wechatAutoAnalyze`（**默认关**）。

**行为**：微信收到对方（`latestFrom == "other"`）的新消息后，自动跑判断与候选，不需要手点。
微信与 QQ／飞书走**同一条链路**：

```
微信前台 → onAccessibilityEvent(TYPE_WINDOW_CONTENT_CHANGED)
  → maybeCapture()                      闸门1：wechatEnabled
  → WeChatAdapter.extract()             读节点树，气泡靠右=me、靠左=other
  → latestFrom == "other"               确认是对方发的
  → prefs.autoAnalyzeFor(pkg)           闸门2：微信走 wechatAutoAnalyze
  → 800ms 去抖 → runAnalysis()          自动判断 + 候选 → 悬浮窗
```

**为什么不在全局 `autoAnalyze` 上做联动**：全局开关被所有适配器读取，飞书的 OCR 路径也读它
（`ocrAutoAnalyze && autoAnalyzeFor(pkg)`）。若让「微信分析」联动全局开关，打开微信会连带
开启 QQ／飞书／X 的自动分析——这不是用户点那个开关时的意图。因此改为**按包名分流**：

```kotlin
fun autoAnalyzeFor(pkg: String?): Boolean =
    if (pkg == PKG_WECHAT) wechatAutoAnalyze && wechatEnabled else autoAnalyze
```

两个分流点（树路径 `maybeCapture`、OCR 路径 `ocrCapture`）都改走这个 helper，避免日后漂移。

`PKG_WECHAT` 收敛为 `Prefs.PKG_WECHAT` 单一来源，服务里改为 `= Prefs.PKG_WECHAT` 别名，
使开关逻辑与服务不可能对"哪个包是微信"产生分歧。

**需要两个开关同时开**：`wechatEnabled`（允许读）+ `wechatAutoAnalyze`（读到后自动分析）。
只开后者不生效——读取都没被允许，没有内容可分析。

---

## 四、其他融合取舍（已确认）

| 项 | 取值 | 理由 |
|---|---|---|
| `enabled` 首次默认 | **false（关）** | 采纳 goutoujunshi 立场：新用户不会被自动读取 |
| `autoAnalyze` 首次默认 | **false（关）** | 同上 |
| 判断 → 起草 时序 | **串行**（判断先，起草带策略） | 采纳 goutoujunshi 三段式；用 `CountDownLatch` 且 `await(12s)` 有界，避免判断不返回时起草任务永久挂起 |
| 构建脚本签名路径 | 改为**仅读环境变量** | 原 jarvis 硬编码 `H:/android/keys/...`，在任何非 Windows 主机上 Gradle 配置阶段即失败 |

---

## 五、验证结果（真实输出）

### 5.1 Kotlin 编译：通过

```
$ kotlinc -jvm-target 17 -classpath <android.jar + 全部依赖> \
    $(find app/src/main/java app/src/test/java -name "*.kt") -d /tmp/out-final
=== EXIT=0 ===
```

零错误零告警。用的是 **kotlinc 1.9.24**，与 `build.gradle.kts` 声明的 Kotlin 版本一致。

### 5.2 单元测试：16/16 通过

```
--- com.jev.probe.capture.ConversationSessionTest
OK (9 tests)
--- com.jev.probe.capture.GuardedInputWriterTest
OK (7 tests)
```

两个安全子系统在融合后行为未变。

### 5.3 融合逻辑断言：34/34 通过

为本次移植的代码新写的验证（`RouteKeys` 密钥同源、`TrendData` CSV 解析与拒错、
`GoutouGuidance` 边界识别、`WeChatAdapter` 候选表与归属/签名逻辑）：

```
== RouteKeys: 同源才复用密钥 ==  8 项 PASS
== TrendData: CSV 解析与方向净差 ==  4 项 PASS
== TrendData: 拒绝非法输入 ==  4 项 PASS
== GoutouGuidance: 明确拒绝 → 不推进 ==  5 项 PASS
TOTAL: pass=21 fail=0

== WeChatAdapter 候选 id 表 ==  5 项 PASS
== 气泡左右归属 ==  3 项 PASS
== 消息签名去重 ==  3 项 PASS
== 空消息快照 = 微信高版本信号 ==  2 项 PASS
TOTAL: pass=13 fail=0
```

### 5.4 微信开关断言：29/29 通过

```
== Prefs.wechatEnabled 声明检查 ==  2 项 PASS
== 默认值必须为 false（安全默认）==  3 项 PASS
== 服务端闸门存在性检查 ==  4 项 PASS
== 设置界面接线检查 ==  3 项 PASS
TOTAL: pass=12 fail=0

== PKG_WECHAT 单一来源 ==  3 项 PASS
== autoAnalyzeFor 路由语义 ==  4 项 PASS
== 两个分流点都走 helper ==  3 项 PASS
== 全局 autoAnalyze 未被破坏 ==  3 项 PASS
== 微信自动分析开关接线 ==  4 项 PASS
TOTAL: pass=17 fail=0
```

**合计 79 项检查全部通过**（16 单测 + 63 断言）。

> 备注：本节写入过程中有一条断言自身写错（用 `contains("prefs.autoAnalyze")` 判断"是否裸用"，
> 而 `prefs.autoAnalyzeFor(pkg)` 含该前缀），已改为词边界正则。**是测试写错，不是代码缺陷**，
> 经直接读取 `ChatCaptureService.kt:415` 确认实现正确。

---

## 六、自验缺口（没验到的，明说）

| 缺口 | 原因 | 影响 |
|---|---|---|
| **未产出 APK** | 本机是 aarch64，Google 只发 x86-64 的 `aapt2`；`processDebugResources` 必然失败 | 需你在 x86 机器或 CI 上出包 |
| **未在真机运行** | 无 Android 设备 | 悬浮窗布局、无障碍事件时序未实测 |
| **未在真微信上验证** | 无设备、且需特定版本微信 | **候选 id 表是否命中、8.0.52 以下是否真的可读，均未实测** |
| 未验证微信风控 | 无法在不使用真实账号的前提下验证 | 见下方风险声明 |

### 风险声明

**节点树读取仍属无障碍采集，微信是否判定为异常行为由腾讯决定。我无法保证不触发风控。**
本次设计把风险面收窄到"只读节点、不截屏"，但这**不等于零风险**。请在你自己的设备与
你有权查看的会话上使用，并自行判断是否接受该风险。

---

## 七、构建方法

```bash
# 需要 JDK 17+ 与 Android SDK（platforms;android-35, build-tools;35.0.0）
cat > local.properties <<'EOF'
sdk.dir=/path/to/android-sdk
EOF

./gradlew :app:testDebugUnitTest :app:assembleDebug
# 产物：app/build/outputs/apk/debug/
```

Release 签名（可选）：设置 `JEV_KEYSTORE_PROPS` 环境变量指向含
`storeFile/storePassword/keyAlias/keyPassword` 的 properties 文件；不设置则 release 不签名。

---

## 八、改动文件清单

**新增（6）**
```
app/src/main/java/com/jev/probe/core/GoutouGuidance.kt
app/src/main/java/com/jev/probe/core/RouteKeys.kt
app/src/main/java/com/jev/probe/core/TrendData.kt
app/src/main/java/com/jev/probe/jev/DeepSeekStrategyClient.kt
app/src/main/java/com/jev/probe/KlineActivity.kt
FUSION.md
```

**修改（9）**
```
core/ChatModels.kt                    Analysis 增加 5 个字段
core/Prefs.kt                         策略三字段、RouteKeys 接入、默认值、hasKey、wechatEnabled
jev/ReplyClient.kt                    狗头军师起草规则 + details/explain/rewrite
jev/JevClient.kt                      策略分流
capture/ChatAppAdapter.kt             WeChatAdapter 多版本 id + 空快照契约
capture/ChatCaptureService.kt         微信六处接线 + 三道开关闸门、策略串行、面板状态、三个 UI 回调
overlay/OverlayController.kt          onDetails/onExplain/onRewrite + showDetails + 两个 pill
SettingsActivity.kt                   新增「微信分析」开关 + 风险说明文案
app/src/main/AndroidManifest.xml      KlineActivity 注册
app/build.gradle.kts                  签名路径可移植化
```
