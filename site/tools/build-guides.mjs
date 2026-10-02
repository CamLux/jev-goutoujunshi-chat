#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(readFileSync(join(root,'content/guides.json'),'utf8'));
const check=process.argv.includes('--check');
const base=`https://${data.host}/`;
const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const jev=data.host==='chatjevs.com';
const umami=jev?'e294ceb6-4001-47a0-a18b-d225cd09017a':'c80c17ab-9413-4d0b-a359-171bc2a23bc9';
let stale=0;
mkdirSync(join(root,'guides'),{recursive:true});
for(const article of data.articles) for(const lang of ['zh','en']) {
 const en=lang==='en', copy=article[lang], file=`guides/${article.slug}${en?'.en':''}.html`,url=base+file;
 const home=en?'../en.html':'../?lang=zh';
 const langUrl=`${article.slug}${en?'':'.en'}.html`;
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'Article','@id':url+'#article',headline:copy.title,description:copy.description,inLanguage:en?'en':'zh-CN',datePublished:article.published,dateModified:article.updated,mainEntityOfPage:url,image:base+data.image,author:{'@type':'Person',name:'Finderchangchang',url:'https://github.com/Finderchangchang'},publisher:{'@type':'Person',name:'Finderchangchang',url:'https://github.com/Finderchangchang'},isPartOf:{'@id':base+'#website'}},
  {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:data.brand,item:base+(en?'en.html':'')},{'@type':'ListItem',position:2,name:copy.title,item:url}]}
 ]};
 const related=data.articles.filter(x=>x.slug!==article.slug).map(x=>`<li><a href="${x.slug}${en?'.en':''}.html">${esc(x[lang].title)}</a></li>`).join('');
 const html=`<!DOCTYPE html>
<html lang="${en?'en':'zh-CN'}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(copy.title)} | ${data.brand}</title>
<meta name="description" content="${esc(copy.description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="zh-CN" href="${base}guides/${article.slug}.html">
<link rel="alternate" hreflang="en" href="${base}guides/${article.slug}.en.html">
<link rel="alternate" hreflang="x-default" href="${base}guides/${article.slug}.html">
<meta property="og:type" content="article"><meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(copy.title)}"><meta property="og:description" content="${esc(copy.description)}">
<meta property="og:image" content="${base+data.image}"><meta name="twitter:card" content="summary_large_image">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="../assets/${jev?'favicon.svg':'favicon.png'}">
<link rel="stylesheet" href="../style.css?v=20260930b"><link rel="stylesheet" href="../guide.css?v=20260930b">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>
<script>try { var theme=localStorage.getItem('${jev?'jev':'brewreel'}-theme'); if(theme==='light'||theme==='dark') document.documentElement.setAttribute('data-theme',theme); } catch(e) {}</script>
<script defer src="https://umami.jisikeji.cn/script.js" data-website-id="${umami}"></script>
</head>
<body>
<a class="guide-skip" href="#main">${en?'Skip to content':'跳到正文'}</a>
<header class="guide-nav"><a class="guide-brand" href="${home}">${en?data.brand:jev?'Jev 聊天助手':'精酿 · BrewReel'}</a><nav aria-label="${en?'Guide navigation':'教程导航'}"><a href="${home}#guides">${en?'All guides':'全部教程'}</a><a href="${langUrl}" hreflang="${en?'zh-CN':'en'}" lang="${en?'zh-CN':'en'}">${en?'简体中文':'English'}</a></nav></header>
<main id="main" class="guide-main">
<article>
<header><p class="guide-kicker">${en?'Practical guide':'使用指南'}</p><h1>${esc(copy.title)}</h1><p class="guide-lead">${esc(copy.description)}</p><p class="guide-meta"><a href="https://github.com/Finderchangchang">Finderchangchang</a> · <time datetime="${article.updated}">${article.updated.slice(0,10)}</time></p></header>
${copy.body}
<aside class="guide-cta"><h2>${en?'Try the project':'开始使用项目'}</h2><p>${esc(copy.cta)}</p><a class="guide-button" href="${data.repo}" target="_blank" rel="noopener" data-umami-event="${jev?'go-main-repo':'click-github'}" data-umami-event-pos="guide-${article.slug}" ${jev?'data-umami-event-intent="get"':''}>${en?'Open the GitHub project':'前往 GitHub 项目主页'} →</a></aside>
<aside class="guide-related"><h2>${en?'Continue reading':'继续阅读'}</h2><ul>${related}<li><a href="${home}">${en?'Product overview, demonstrations and limitations':'产品介绍、演示与已知限制'}</a></li></ul></aside>
</article>
</main>
<footer class="guide-footer">© 2026 Finderchangchang · <a href="${data.repo}">GitHub</a> · <a href="${home}">${en?'Official website':'官网'}</a></footer>
</body></html>
`;
 const path=join(root,file);
 if(check){if(!existsSync(path)||readFileSync(path,'utf8').replace(/\r\n/g,'\n')!==html){console.error('Stale guide: '+file);stale++;}}
 else writeFileSync(path,html,'utf8');
}
if(stale)process.exit(1);
console.log(`${check?'Verified':'Generated'} ${data.articles.length*2} guide pages for ${data.host}`);
