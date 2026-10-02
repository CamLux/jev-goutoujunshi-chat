#!/usr/bin/env node
// Run after check-i18n.mjs --fix. --check detects stale published artifacts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, encodeAttr, DICT } from './check-i18n.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const source = readFileSync(join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const host = existsSync(join(root, 'CNAME')) ? readFileSync(join(root, 'CNAME'), 'utf8').trim() : new URL(/<link rel="canonical" href="([^"]+)"/.exec(source)[1]).hostname;
if (!['chatjevs.com', 'brewreel.com'].includes(host)) throw new Error('Unexpected canonical host');
const base = `https://${host}/`;
const jev = host === 'chatjevs.com';
const repo = jev ? 'https://github.com/jev-chat/jev-chat-jarvis' : 'https://github.com/Finderchangchang/brewreel';
const text = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const output = new Map();
const guidePath = join(root, 'content/guides.json');
const guides = existsSync(guidePath) ? JSON.parse(readFileSync(guidePath, 'utf8')).articles : [];

function translated(html, lang) {
  const { inner, attrs } = scan(html);
  const dict = DICT[lang];
  const edits = inner.map(it => {
    if (dict[it.key] == null) throw new Error(`Missing ${lang} translation: ${it.key}`);
    return { start: it.innerStart, end: it.innerEnd, text: dict[it.key] };
  });
  const tags = new Map();
  for (const at of attrs) {
    if (dict[at.key] == null) throw new Error(`Missing ${lang} attribute: ${at.key}`);
    if (!tags.has(at.tagStart)) tags.set(at.tagStart, {start: at.tagStart, end: at.tagEnd, text: html.slice(at.tagStart, at.tagEnd)});
    const edit = tags.get(at.tagStart);
    const re = new RegExp(`(\\s${at.attr.replace(/[-.]/g, '\\$&')}\\s*=\\s*)("[^"]*"|'[^']*')`, 'i');
    if (!re.test(edit.text)) throw new Error(`Missing attribute ${at.attr}`);
    edit.text = edit.text.replace(re, (_, prefix) => `${prefix}"${encodeAttr(dict[at.key])}"`);
  }
  edits.push(...tags.values());
  for (const edit of edits.sort((a, b) => b.start-a.start)) html = html.slice(0, edit.start)+edit.text+html.slice(edit.end);
  return html;
}

for (const lang of ['zh', 'en']) {
  const dict = DICT[lang];
  const url = base + (lang === 'en' ? 'en.html' : '');
  const name = jev ? (lang === 'en' ? 'Jev Chat Assistant' : 'Jev 聊天助手') : (lang === 'en' ? 'BrewReel · 精酿' : '精酿 · BrewReel');
  const software = {
    '@type': jev ? 'SoftwareApplication' : 'SoftwareSourceCode',
    '@id': base+'#software', name,
    alternateName: jev ? ['Jev Chat Assistant', 'Jev 聊天助手'] : ['BrewReel', '精酿'],
    url: base, description: dict['facts.desc'], sameAs: [repo],
    author: {'@id': base+'#author'},
    ...(jev ? {applicationCategory: 'CommunicationApplication', operatingSystem: ['Android', 'Windows', 'macOS']} : {
      codeRepository: repo, license: repo+'/blob/main/LICENSE', programmingLanguage: ['JavaScript', 'TypeScript', 'Python']
    })
  };
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {'@type': 'Person', '@id': base+'#author', name: 'Finderchangchang', url: 'https://github.com/Finderchangchang'},
      {'@type': 'WebSite', '@id': base+'#website', url: base, name, inLanguage: ['zh-CN', 'en'], publisher: {'@id': base+'#author'}},
      software,
      {'@type': 'WebPage', '@id': url+'#webpage', url, name: dict['meta.title'], description: dict['meta.desc'], inLanguage: lang === 'en' ? 'en' : 'zh-CN', isPartOf: {'@id': base+'#website'}, mainEntity: {'@id': base+'#software'}}
    ]
  };
  let html = translated(source, lang)
    .replace(/<html lang="[^"]+"/, `<html lang="${lang === 'en' ? 'en' : 'zh-CN'}"`)
    .replace(/(<link rel="canonical" href=")[^"]+/, `$1${url}`)
    .replace(/(<meta property="og:url" content=")[^"]+/, `$1${url}`)
    .replace(/<script type="application\/ld\+json" id="site-schema">[\s\S]*?<\/script>/,
      `<script type="application/ld+json" id="site-schema">\n${JSON.stringify(graph, null, 2).replace(/</g, '\\u003c')}\n</script>`);
  if (lang === 'en' && jev) html = html.replace(/href=(['"])privacy\.html\1/g, 'href="privacy.html#en-summary"');
  output.set(lang === 'en' ? 'en.html' : 'index.html', html);
}

const alternates = `<xhtml:link rel="alternate" hreflang="zh-CN" href="${base}"/><xhtml:link rel="alternate" hreflang="en" href="${base}en.html"/><xhtml:link rel="alternate" hreflang="x-default" href="${base}"/>`;
const guideUrls = guides.map(article => {
  const zh = `${base}guides/${article.slug}.html`, en = `${base}guides/${article.slug}.en.html`;
  const links = `<xhtml:link rel="alternate" hreflang="zh-CN" href="${zh}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${zh}"/>`;
  return [zh,en].map(url=>`  <url><loc>${url}</loc><lastmod>${article.updated}</lastmod>${links}</url>\n`).join('');
}).join('');
output.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n  <url><loc>${base}</loc>${alternates}</url>\n  <url><loc>${base}en.html</loc>${alternates}</url>\n${jev ? `  <url><loc>${base}privacy.html</loc></url>\n` : ''}${guideUrls}</urlset>\n`);
output.set('robots.txt', `# Public website content is crawlable.\nUser-agent: *\nAllow: /\n\n# Search discovery (these are not training-specific permissions).\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`);

// A convenience index for readers/tools that use it, not a ranking directive.
let facts = `# ${jev ? 'Jev Chat Assistant / Jev 聊天助手' : 'BrewReel / 精酿'}\n\n> ${DICT.en['facts.desc']}\n\n${DICT.zh['facts.desc']}\n\n## Official pages\n\n- [简体中文](${base}): Product overview, requirements and limitations.\n- [English](${base}en.html): Complete static English page.\n- [GitHub](${repo}): Source code, installation and platform documentation.\n- [Releases](${repo}/releases): Published releases.\n`;
if (jev) facts += `- [Privacy policy](${base}privacy.html): Android data handling; English summary at #en-summary.\n`;
else facts += `- [Project license](${repo}/blob/main/LICENSE): Apache-2.0.\n- [Third-party licenses](${repo}/blob/main/THIRD_PARTY_LICENSES.md): Includes Remotion licensing requirements.\n`;
facts += '\n## Product facts\n\n';
for (const key of ['use', 'scope', 'cost']) facts += `- ${DICT.en[`facts.${key}.label`]}: ${text(DICT.en[`facts.${key}`])}\n- ${DICT.zh[`facts.${key}.label`]}：${text(DICT.zh[`facts.${key}`])}\n`;
facts += `\n${text(DICT.en['facts.source'])}\n\n## Read before use\n\n`;
facts += jev ? `- Reply sending remains a user decision. Model assessments are uncertain.\n- Android chat text is sent to the model endpoint configured by the user; local OCR does not make the whole application offline.\n- Android features and permissions must not be assumed to apply to desktop versions.\n- iOS is not supported; a browser version is not currently available.\n` : `- A language model writes the storyboard; rendering is performed locally with code.\n- Generated videos are drafts that need human review before publication.\n- Model and voiceover API calls may incur separate provider fees.\n- The DeepSeek Harness plugin is published, but the project documentation still marks real DeepSeek-model testing as pending.\n- MiniMax voiceover has been tested; Alibaba Cloud and Volcengine voiceover still need live-key verification.\n`;
if (guides.length) {
  facts += '\n## Practical guides\n\n';
  for (const article of guides) {
    facts += `- [${article.zh.title}](${base}guides/${article.slug}.html): ${article.zh.description}\n`;
    facts += `- [${article.en.title}](${base}guides/${article.slug}.en.html): ${article.en.description}\n`;
  }
}
output.set('llms.txt', facts);

let stale = 0;
for (const [file, body] of output) {
  const path = join(root, file);
  if (check) {
    if (!existsSync(path) || readFileSync(path, 'utf8').replace(/\r\n/g, '\n') !== body) { console.error(`Stale: ${file}`); stale++; }
  } else writeFileSync(path, body, 'utf8');
}
if (stale) process.exit(1);
console.log(`${check ? 'Verified' : 'Generated'} ${output.size} discovery artifacts for ${host}`);
