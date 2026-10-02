# 维护说明

chatjevs.com 是纯静态站：GitHub Pages 从 `jev-chat/jev-chat.github.io` 的 `main` 分支根目录直出，没有框架，发布时无需构建；维护时需生成英文页和发现文件（见下文）。合并到 `main` 就是上线。同一套页面另有两份拷贝（`jev-chat-jarvis` 仓库的 `site/` 目录和 `gh-pages` 分支），改完这里要同步过去。

## 文件一览

| 文件 | 作用 |
|---|---|
| `index.html` | 首页结构。默认内容是中文，每段文案用 `data-i18n` 键对应字典 |
| `i18n.js` | **首页文案的单一来源**：`zh`、`en` 两个字典 |
| `main.js` | 行为：中英切换、主题、导航、复制、首屏演示、进场动效、Star 数。首页和隐私页共用 |
| `style.css` | 样式。设计令牌在文件开头，浅色 / 深色两套；隐私页样式在文件末尾 |
| `privacy.html` | 隐私政策。**只有中文**，不走字典；页底有英文摘要 `#en-summary` |
| `tools/check-i18n.mjs` | 中英文案检查；`--fix` 把中文从字典写进 `index.html` |
| `assets/` | `favicon.svg`、`apple-touch-icon.png`、`og.png`（1200×630）、`mp-qr.webp`（公众号二维码）（旧版截图 `overlay.webp`、`settings.webp` 已删除，见 DESIGN.md 决策 1） |
| `download/` | 历史 APK。**文件名不要改或删除**，App、README、外部文章可能直链；官网页面不再提供直下入口 |
| `CNAME`、`.nojekyll` | 域名 chatjevs.com 和关闭 Jekyll，**不要删** |
| `DESIGN.md` | 设计说明：信息架构、视觉语言、为什么这么做、旧版内容去向 |

## 改首页文案

1. 只改 `i18n.js`，中英两个字典一起改。
2. 跑 `node tools/check-i18n.mjs --fix`：把中文写进 `index.html`（没有 JS 的访客、搜索引擎、社交平台抓取看到的就是这份中文）。
3. 再跑一遍 `node tools/check-i18n.mjs`，看到「✓ 中英文案一致，没有缺键和孤儿键」再提交。
4. 跑 `node tools/build-discovery.mjs`，同步静态英文页、JSON-LD、sitemap、robots 和文本资料，再跑 `node tools/build-discovery.mjs --check` 检查没有过期产物。
5. 本地看一眼（见「本地预览」），中文、`?lang=en` 各看一遍。

检查脚本会拦下：HTML 里用了但字典里没有的键、中英字典键不一致、HTML 里的中文和字典不一致、字典里没人用的孤儿键、重复键、空值、`data-i18n` 嵌套。英文里混进汉字会给提醒（「切换到中文」「接口」「清空知识库与历史」这三处是故意的：App 界面是中文，英文用户要照着找按钮）。

**写法约定**

- `data-i18n="键"`：替换元素的 innerHTML，值可以带 `<a>`、`<strong>`、`<b>` 等标签。字典里 HTML 属性一律用**单引号**。
- `data-i18n-attr="属性:键;属性:键"`：替换属性，值是纯文本（`alt`、`aria-label`、`title`、`content`）。
- 带 `data-i18n` 的元素里面不能再套带 `data-i18n` 或 `data-i18n-attr` 的元素。图标、版本号这类不随语言变的东西放在旁边的兄弟节点里。
- `main.js` 里要用文案时写 `t("键")`，检查脚本会扫描这些调用；数组写法 `t(["a", "b"][i])` 也认。
- 新加一段文案：先在两个字典里加键，再在 HTML 里写空元素 `<p data-i18n="新键"></p>`，跑 `--fix` 填中文。

**文案口径**（和作者历次拍板一致）

- 不出现已停止支持的那个聊天 App 的名字（中英文都不写），姊妹项目介绍也一样。
- 兼容性只说「非侵入、只读屏幕、不改任何 App 的安装包、不走它们的接口或账号」这个意思，不写任何对抗检测类的技术词。
- 隐私只如实说「发给谁、发什么、存在哪、怎么删」，不写「什么都不收集」一类承诺，也不写任何安全保证。
- 不写效果数字（准确率、省多少时间）；不编 Star 数、下载量、用户数。
- 署名只写 GitHub 账号 Finderchangchang，不写真名。
- 不写广告法极限词和英文同类词。
- 二维码只有公众号一张，不新增。

每次改完跑一遍禁词检查。禁词清单（极限词、停用平台名、真名等）**不放进仓库**：存成仓库外的一个文本文件，每行一个词，然后：

```bash
grep -rnFf <仓库外的禁词清单.txt> --include=*.html --include=*.js --include=*.mjs --include=*.css --include=*.md .
# 应当只剩 privacy.html 正文里 7 处「时间 / 数量」的普通用法（见 DESIGN.md 第 9 节）；CSS 里的颜色值和宽度百分比不算
grep -n 'src="/\|href="/' index.html privacy.html   # 本地资源必须是相对路径，应当没有输出
```

## 功能状态变化时改哪里

以 GitHub 上 `jev-chat/jev-chat-jarvis` **已发布的 Release** 为准，不写 CHANGELOG「未发布」里的东西。

| 变化 | 要改的键 / 位置 |
|---|---|
| 支持的 App 增减或状态变化 | `apps.*`（04 节表格，`index.html` 的 `.st` 里加减 `<tr>`）、首屏「已跑通」`app.*`、`meta.desc`、`faq.a6`；OG 图下面的标签不含 App 名，不用改 |
| 判断 / 回复接口预设变化（比如 Vercel、OpenCode Zen 预设随新版发布） | `how.f3`、`faq.a3`、`priv.d.apiList`，中英各一处 |
| 博查 Jev 不再限时免费 | 删掉 `s2.tip` 和 `faq.a3` 里「限时免费」那半句 |
| 某条已知限制解除 | 删掉对应 `lim.N`（两个字典 + `index.html` 的 `<li>`），序号不用连续 |
| 新增一条已知限制 | 加 `lim.N`，`index.html` 的 `.lim ul` 里加 `<li data-i18n="lim.N"></li>`，跑 `--fix` |
| 判断题目变化（`JevQuestions.kt`） | `jq.*`（题名、选项）、`jq.lead`；首屏演示的标签格式看 `OverlayController.kt` 有没有变 |
| 悬浮窗样式变化 | `style.css` 里「悬浮窗」一段（`.jp*`），颜色、字号照源码 |
| 隐私政策改版 | 见下文「隐私政策」 |

## 版本号与产品获取入口

**安卓新版本**：以主仓库已发布的 Release 为准更新 `index.html` 中三端卡片的 Android 版本、05 节 adb 文件名、收尾版本行（三端版本独立，JSON-LD 不使用统一 `softwareVersion`）；如包体大小变化，更新 `lim.8` 中英文案。下载文件及入口在主仓库 README 和 Release 维护，官网获取链接仍指向主仓库三端区。旧 `download/` 文件继续保留供既有外链使用。

**Windows / macOS 新版本**：确认正式发布页后，更新 05 节对应卡片和收尾版本行。官网仍只指向主仓库三端区，不直接分流到桌面仓库。

**Star 兜底值**：`<b data-jev-stars>` 位于三端卡片后的支持提示。页面会实时拉 GitHub，拉不到才显示这个值；隔段时间按实际数更新静态兜底值。访客浏览器缓存 30 分钟（`localStorage` 的 `jev-gh`）。

**缓存版本号**：改了 `style.css`、`main.js`、`i18n.js` 任意一个，把 `index.html` 和 `privacy.html` 里的资源查询参数一起改成新的日期与字母，否则回访用户会拿到旧文件。

**入口规则**：所有产品获取、安装教程、交流与更新入口的静态 `href` 统一指向 `https://github.com/jev-chat/jev-chat-jarvis`，不带 README 章节锚点；用户先进入仓库首页，再在 GitHub 内分流。Android、Windows、macOS 卡片同级显示。隐私政策、许可、Issue 和更新日志按自身用途保留原链接。不要恢复 `data-jev-apk`、`download-apk` 或跨域 APK 改写脚本。
## 隐私政策（privacy.html）

- 正文来自 App 仓库的 `PRIVACY.md`，App 设置页「隐私政策」按钮直链 `https://chatjevs.com/privacy.html`，**路径不能变**。
- 这一版只换了样式和导航 / 页脚，`<main>` 里的正文文字和旧版逐字一致。以后正文改动以 `PRIVACY.md` 为准，照原来的 HTML 结构改（`h2` 带 `id`、表格用 `.table-scroll` + `table.legal`、英文摘要在 `#en-summary`）。
- 首页英文模式下，所有隐私链接都指向 `privacy.html#en-summary`（`data-privacy-link` 属性，脚本自动改）。
- 核对正文有没有被误改：

  ```bash
  git show <旧提交>:privacy.html > /tmp/old.html
  python - /tmp/old.html privacy.html <<'EOF'
  import re, sys, html
  def t(p):
      s = open(p, encoding="utf-8").read()
      m = re.search(r'<main id="main">(.*?)</main>', s, re.S).group(1)
      return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", m))).strip()
  print("一致" if t(sys.argv[1]) == t(sys.argv[2]) else "不一致")
  EOF
  ```

## Umami 事件

脚本在两个页面的 `</head>` 前，站点 ID `e294ceb6-4001-47a0-a18b-d225cd09017a`。链接和按钮用 `data-umami-event` 属性上报，脚本控制的动作在 `main.js` 里用 `umami.track` 上报。

| 事件 | 触发 | 附带属性 |
|---|---|---|
| `go-main-repo` | 点主仓库获取、教程或交流入口 | `pos`：入口位置；`intent`：get / android / windows / macos / tutorial / community。改版前的 `download-apk` 和 `click-star` 保留历史含义，不与新事件直接比较 |
| `click-github` | 点更新日志 | `pos`：footer-changelog / privacy-footer-changelog |
| `click-issues` | 点提 Issue | `pos`：faq / contact / footer / privacy-footer |
| `view-privacy` | 点隐私政策 | `pos`：privacy / faq / footer / footer-legal |
| `copy-adb` | 点复制 adb 命令 | — |
| `toggle-lang` | 点 中 / EN | `to`：zh / en |
| `toggle-theme` | 点深浅色 | `to`：light / dark |
| `demo-control` | 首屏演示暂停、播放、点某一步 | `action`：pause / play / step-1…step-4 |
| `privacy-en-summary` | 隐私页顶栏点 English | — |

`go-main-repo` 只代表从官网点击进入主仓库，不代表实际 Star、下载或安装。Star 增长要另看仓库每日净增，并记录推广和流量来源变化。

注意：Umami 对站内链接（不是 `target="_blank"`）会先拦下点击、上报完再跳转。首屏演示的步骤按钮是 `<button>`，不受影响。

## OG 图

`assets/og.png`（1200×630）是用首页的手机样机 HTML 截出来的：左边 logo、中英名称、口号、一句话说明、三个标签，右边是悬浮窗收尾状态的手机（缩到 0.86）。换口号或悬浮窗样式时重做：写一个临时 HTML 引用 `style.css` 和首页的 `.phone` 片段，用无头 Chrome 以 1200×630、关闭 JS 截图，再用 Pillow 存成 PNG。路径保持 `assets/og.png`，社交平台缓存会自己更新。

## 本地预览与上线前检查

```bash
python -m http.server 8821 --bind 127.0.0.1
# 打开 http://127.0.0.1:8821/ 、 /?lang=en 、 /privacy.html
node tools/check-i18n.mjs
```

上线前至少看：1440 宽和 375 宽、浅色和深色、中文和英文；375 宽下 `document.documentElement.scrollWidth` 应当等于 375；控制台没有报错；关掉 JS、打开「减弱动态效果」时内容完整可见（演示停在收尾状态）；手机首屏能看到 GitHub 获取按钮，三端卡片均直接展开且同级。再核对导流入口均直达仓库首页且不带章节锚点，以及 Umami 是否收到新事件。

## 英文用词

英文名统一写 **Jev Chat Assistant**。下面是按中文 README 和已提交的 awesome 清单条目定下的译法；标 ⚠ 的是拿不准、欢迎改的。

| 中文 | 英文 | 说明 |
|---|---|---|
| 对话副驾 | chat copilot | 同 awesome 条目 |
| 一键填进输入框，发不发由你 | fills the one you pick into the input box; sending stays manual / whether to send is up to you | 同 awesome 条目 |
| 填入 / 复制（悬浮窗按钮） | Fill / Copy | |
| 危险等级 | danger level | 同 awesome 条目 |
| 安全 / 留神 / 偏危险 / 很危险 | Safe / Careful / Risky / High risk | ⚠「留神」译作 Careful |
| 对方真实意图 | True intent | |
| 该不该马上回 | Reply with substance now? | ⚠ 中文口径是「马上回」，源码问的是「下一句该不该给实质内容」，英文按源码意思译 |
| 先别给实质 / 可给实质 | hold off on substance / give substance | ⚠ |
| 接住情绪 | Acknowledge (the feeling) | |
| 少说两句 | Say less | |
| 同一个「嗯」 | the same “k” | ⚠ 用英文里同样冷淡的一个字母回复来对应 |
| 演示里的「对象」 | Jamie | ⚠ 用一个中性的名字代替「对象」 |
| 公众号 | official account (Chinese) | 不写平台名 |
| 红包 | red packets | |
| 飞书 | Feishu / Lark | |
| 通义兼容 | Qwen-compatible | |
| 博查 Jev / TypeSafe 直连 | Bocha Jev / TypeSafe direct | |
| 全链路 / OCR 兜底 / 手动识别 | Full flow / OCR fallback / Manual | |
| 非侵入 | non-invasive | |
| 知识库与关联上下文 | notes and contact context | 问答里也写 knowledge base，两种说法都指同一个功能 |
| 姊妹项目 | sister projects | |

## 首次访问语言

首页按以下顺序决定语言：有效的 `?lang=zh/en` → `/en.html` 固定英文入口 → 用户手动保存的选择 → 浏览器首选语言（中文显示中文，其余显示英文）。语言不符时导航到相应静态页；手动按钮保存选择并保留分享参数与章节。

公众号可以分享 `https://chatjevs.com/?lang=zh`，英文渠道可以分享 `https://chatjevs.com/?lang=en`。无参数链接自动适配。检测逻辑位于首页 head，main.js 复用其结果，避免首屏语言不一致。不依赖 IP、地区或来源网站。隐私政策仍保留中文全文与英文摘要；首页英文入口直达英文摘要。


## 搜索与 AI 搜索维护（2026-09-30）

- 中文页面 `/`，英文页面 `/en.html`：都包含完整静态正文、各自 canonical、互相对应的 hreflang、OG 和与可见正文一致的 JSON-LD。英文页由字典生成，不手改。
- 保留旧 `?lang=zh/en` 分享链接。启用 JS 时导航到对应静态页面；无 JS 的英文入口使用 `/en.html`。页脚语言链接在无 JS 时也可用。
- 常见问题有稳定的 `#faq-q1` 等锚点，可直接分享某一问题。
- `facts.*` 是产品定位、使用范围、费用和来源的文案来源；`llms.txt` 从同一份文案生成。它是方便读取的文本索引，不是搜索收录或 AI 推荐的保证。
- `robots.txt` 允许公开页面抓取，明确列出 OAI-SearchBot / PerplexityBot。两站此前没有 robots.txt，本次保留默认可抓取状态；搜索爬虫和模型训练爬虫用途不同。
- `sitemap.xml` 只列本站规范页面，不填猜测的修改日期；保留自引用及双向 hreflang。镜像使用官方域名 canonical，不生成镜像域名版本。
- 不写虚构评分、评价、用户数或背书；不添加仅供机器看到的功能承诺。Jev 三端版本各自维护，不能用 Android 版本号代表三端，也不能把 Android 的许可/权限说明概括成所有平台相同。

维护命令：

```bash
node tools/check-i18n.mjs --fix
node tools/build-guides.mjs
node tools/build-guides.mjs --check
node tools/build-discovery.mjs
node tools/build-discovery.mjs --check
node --check main.js
git diff --check
```

上线前检查两种语言、375 / 1440 宽度、浅深色、禁用 JS、语言切换和隐私链接。确认 sitemap 内页面返回 200，robots 不屏蔽正文，线上文件与提交一致。

效果验证：在已有的 Search Console / Bing Webmaster Tools 中提交 sitemap，查看实际抓取/索引与 AI 搜索表现；Umami 的 AI 来源访问与 GitHub 入口点击只说明访问和点击，不能当作被 AI 推荐的次数或下载数。不要为了提交 sitemap 采用已废弃的匿名 ping 接口。账号验证与后续表现以平台真实记录为准。

依据：[Google AI 搜索指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)、[OpenAI 爬虫说明](https://developers.openai.com/api/docs/bots)、[Perplexity 爬虫说明](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)。


## 教程与主动通知收录

`content/guides.json` 保存中英文教程正文、来源和真实发布日期；`tools/build-guides.mjs` 生成 `guides/*.html`。更新正文时同步中英文，并更新对应文章的 updated 日期。不要改动日期来制造内容新鲜度。

生成命令为 `node tools/build-guides.mjs`，检查用 `--check`。教程由首页「从这里开始用」链接，并由 build-discovery 加入 sitemap 和 llms.txt。`guide.css` 是教程样式。BrewReel 的可下载 Markdown 位于 downloads/。

`indexnow-key.txt` 是 IndexNow 协议要求放在网站公开根目录的所有权证明，不能用真实 API 密钥替代。上线后先跑 `node tools/submit-indexnow.mjs` 预览 URL；带 `--submit` 才会验证线上证明文件与页面，再向 IndexNow 提交本站 sitemap 中的 URL。200 表示收到通知，202 表示收到且待验证；两者都不代表页面已经收录。仅在发布实质修改后提交，不定时重复刷提交。

教程访问记为 read-guide，BrewReel 模板下载点击记为 download-brief-template / download-brief-example；这些是点击事件，不是下载完成、安装或转化。教程进入 GitHub 的事件保留现有事件名与独立位置属性。
