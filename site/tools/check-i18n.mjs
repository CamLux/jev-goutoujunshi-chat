#!/usr/bin/env node
/*
 * Jev 聊天助手官网的中英文案检查（无依赖，node 18+ 直接跑）
 *
 *   node tools/check-i18n.mjs          只检查，有错误时退出码 1
 *   node tools/check-i18n.mjs --fix    先把 i18n.js 里的中文写进 index.html，再检查
 *
 * 检查项：
 *   1. index.html 里每个 data-i18n / data-i18n-attr 的键，在 zh 和 en 两个字典里都存在
 *   2. index.html 里的中文内容和 zh 字典一致（空白折叠后比较）
 *   3. zh、en 两个字典的键完全一致
 *   4. 没有孤儿键：字典里的键要么被 index.html 用到，要么被 main.js 的 t("...") 用到
 *   5. 字典里没有重复键、没有空值
 *   6. 提醒：en 值里出现汉字（「切换到中文」「接口」「清空知识库与历史」这几个 App 界面原文除外）
 *   7. data-i18n 元素不能嵌套，也不能包住带 data-i18n-attr 的元素
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML_PATH = join(ROOT, "index.html");
const DICT_PATH = join(ROOT, "i18n.js");
const JS_PATHS = [join(ROOT, "main.js")];
const FIX = process.argv.includes("--fix");
const EN_HAN_ALLOW = ["切换到中文", "接口", "清空知识库与历史"];

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style"]);

const errors = [];
const warnings = [];

/* ---------- 读字典 ---------- */
const dictSrc = readFileSync(DICT_PATH, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(dictSrc, sandbox, { filename: "i18n.js" });
const DICT = sandbox.window.JEV_I18N;
if (!DICT || !DICT.zh || !DICT.en) {
  console.error("i18n.js 里没有找到 window.JEV_I18N = { zh: {...}, en: {...} }");
  process.exit(1);
}

// 重复键：对象字面量里的重复键会被静默覆盖，只能扫源码
(function findDuplicates() {
  const zhAt = dictSrc.indexOf('"zh": {');
  const enAt = dictSrc.indexOf('"en": {');
  if (zhAt < 0 || enAt < 0) {
    warnings.push('没找到 "zh": { 或 "en": { 标记，跳过重复键检查');
    return;
  }
  const blocks = { zh: dictSrc.slice(zhAt, enAt), en: dictSrc.slice(enAt) };
  for (const lang of ["zh", "en"]) {
    const seen = new Map();
    const re = /^\s*"([^"]+)"\s*:/gm;
    let m;
    while ((m = re.exec(blocks[lang]))) {
      if (m[1] === lang) continue;
      seen.set(m[1], (seen.get(m[1]) || 0) + 1);
    }
    for (const [k, n] of seen) if (n > 1) errors.push(`[${lang}] 重复键 "${k}"（出现 ${n} 次）`);
  }
})();

/* ---------- 解析 HTML ---------- */
function parseAttrs(str) {
  const out = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(str))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

function decodeAttr(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function encodeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const norm = (s) => s.replace(/\s+/g, " ").trim();

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

function scan(html) {
  const inner = []; // { key, innerStart, innerEnd, line }
  const attrs = []; // { attr, key, tagStart, tagEnd, tagText, value, line }
  const stack = [];
  const tagRe = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m[0].startsWith("<!")) continue;
    if (m[1]) {
      const name = m[1].toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === name) {
          const closed = stack.splice(i);
          const el = closed[0];
          if (el.key != null) inner.push({ key: el.key, innerStart: el.innerStart, innerEnd: m.index, line: el.line });
          break;
        }
      }
      continue;
    }
    const name = m[2].toLowerCase();
    const a = parseAttrs(m[3] || "");
    const line = lineOf(html, m.index);
    const insideI18n = stack.some((s) => s.key != null);

    if (a["data-i18n-attr"] != null) {
      if (insideI18n) errors.push(`index.html:${line} <${name}> 带 data-i18n-attr，却在 data-i18n 元素里面（换语言时会被整段覆盖）`);
      for (const pair of a["data-i18n-attr"].split(";")) {
        const [attr, key] = pair.split(":").map((s) => (s || "").trim());
        if (!attr || !key) { errors.push(`index.html:${line} data-i18n-attr 写法不对："${pair}"`); continue; }
        attrs.push({ attr: attr.toLowerCase(), key, tagStart: m.index, tagEnd: m.index + m[0].length, value: a[attr.toLowerCase()], line });
      }
    }

    const selfClosing = m[4] === "/" || VOID.has(name);
    if (a["data-i18n"] != null) {
      if (selfClosing) errors.push(`index.html:${line} <${name}> 是空元素，不能用 data-i18n（改用 data-i18n-attr）`);
      if (insideI18n) errors.push(`index.html:${line} data-i18n="${a["data-i18n"]}" 嵌套在另一个 data-i18n 元素里`);
    }
    if (RAW.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, tagRe.lastIndex);
      tagRe.lastIndex = close < 0 ? html.length : close;
      continue;
    }
    if (!selfClosing) stack.push({ name, key: a["data-i18n"] ?? null, innerStart: m.index + m[0].length, line });
  }
  for (const s of stack) if (s.key != null) errors.push(`index.html:${s.line} data-i18n="${s.key}" 的元素没有闭合`);
  return { inner, attrs };
}

let html = readFileSync(HTML_PATH, "utf8");

/* ---------- --fix：把 zh 字典写进 index.html ---------- */
if (FIX) {
  const { inner, attrs } = scan(html);
  const edits = [];
  for (const it of inner) {
    const v = DICT.zh[it.key];
    if (v == null) continue;
    if (html.slice(it.innerStart, it.innerEnd) !== v) edits.push({ start: it.innerStart, end: it.innerEnd, text: v });
  }
  // 同一个标签上的多个属性要合并成一次编辑
  const byTag = new Map();
  for (const at of attrs) {
    const v = DICT.zh[at.key];
    if (v == null) continue;
    if (!byTag.has(at.tagStart)) byTag.set(at.tagStart, { start: at.tagStart, end: at.tagEnd, text: html.slice(at.tagStart, at.tagEnd) });
    const e = byTag.get(at.tagStart);
    const re = new RegExp(`(\\s${at.attr.replace(/[-.]/g, "\\$&")}\\s*=\\s*)("[^"]*"|'[^']*')`, "i");
    if (re.test(e.text)) e.text = e.text.replace(re, (_, p1) => `${p1}"${encodeAttr(v)}"`);
    else e.text = e.text.replace(/^<([a-zA-Z][\w-]*)/, (x) => `${x} ${at.attr}="${encodeAttr(v)}"`);
  }
  for (const e of byTag.values()) if (e.text !== html.slice(e.start, e.end)) edits.push(e);
  edits.sort((x, y) => y.start - x.start);
  for (const e of edits) html = html.slice(0, e.start) + e.text + html.slice(e.end);
  writeFileSync(HTML_PATH, html, "utf8");
  console.log(`--fix：写入 ${edits.length} 处中文到 index.html`);
}

/* ---------- 检查 ---------- */
const { inner, attrs } = scan(html);
const used = new Set();

for (const it of inner) {
  used.add(it.key);
  const zh = DICT.zh[it.key];
  if (zh == null) { errors.push(`index.html:${it.line} 键 "${it.key}" 不在 zh 字典里`); continue; }
  if (DICT.en[it.key] == null) errors.push(`index.html:${it.line} 键 "${it.key}" 不在 en 字典里`);
  const got = html.slice(it.innerStart, it.innerEnd);
  if (norm(got) !== norm(zh)) {
    errors.push(`index.html:${it.line} "${it.key}" 的中文和字典不一致\n      页面：${norm(got).slice(0, 90)}\n      字典：${norm(zh).slice(0, 90)}`);
  }
}
for (const at of attrs) {
  used.add(at.key);
  const zh = DICT.zh[at.key];
  if (zh == null) { errors.push(`index.html:${at.line} 属性键 "${at.key}" 不在 zh 字典里`); continue; }
  if (DICT.en[at.key] == null) errors.push(`index.html:${at.line} 属性键 "${at.key}" 不在 en 字典里`);
  if (at.value == null) errors.push(`index.html:${at.line} 标签上没有 ${at.attr} 属性（键 "${at.key}"）`);
  else if (norm(decodeAttr(at.value)) !== norm(zh)) errors.push(`index.html:${at.line} ${at.attr}（"${at.key}"）和字典不一致\n      页面：${decodeAttr(at.value)}\n      字典：${zh}`);
}

for (const p of JS_PATHS) {
  // 去掉注释后找 t(...) 调用，括号里的每个字符串字面量都算用到（支持 t(ok ? "a" : "b")）
  const src = readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const call = /\bt\(([^()]*)\)/g;
  let m;
  while ((m = call.exec(src))) {
    const lit = /["']([\w.-]+)["']/g;
    let k;
    while ((k = lit.exec(m[1]))) {
      used.add(k[1]);
      if (DICT.zh[k[1]] == null || DICT.en[k[1]] == null) errors.push(`${p.split(/[\\/]/).pop()} 用到的键 "${k[1]}" 不在两个字典里`);
    }
  }
}

const zhKeys = Object.keys(DICT.zh);
const enKeys = Object.keys(DICT.en);
for (const k of zhKeys) if (!(k in DICT.en)) errors.push(`键 "${k}" 只在 zh 里，en 缺`);
for (const k of enKeys) if (!(k in DICT.zh)) errors.push(`键 "${k}" 只在 en 里，zh 缺`);
for (const k of zhKeys) if (!used.has(k)) errors.push(`孤儿键 "${k}"：index.html 和 main.js 都没用到`);
for (const lang of ["zh", "en"]) {
  for (const [k, v] of Object.entries(DICT[lang])) if (typeof v !== "string" || !v.trim()) errors.push(`[${lang}] "${k}" 是空值`);
}
for (const [k, v] of Object.entries(DICT.en)) {
  let s = String(v);
  for (const ok of EN_HAN_ALLOW) s = s.split(ok).join("");
  if (/\p{Script=Han}/u.test(s)) warnings.push(`en "${k}" 里有汉字：${String(v).slice(0, 80)}`);
}

console.log(`字典：zh ${zhKeys.length} 键，en ${enKeys.length} 键；index.html：${inner.length} 处 data-i18n，${attrs.length} 处 data-i18n-attr`);
for (const w of warnings) console.log(`  提醒  ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`  错误  ${e}`);
  console.log(`\n✗ ${errors.length} 个错误`);
  process.exit(1);
}
console.log("✓ 中英文案一致，没有缺键和孤儿键");

// Reuse the HTML scanner for deterministic static language generation.
export { scan, encodeAttr, DICT };
