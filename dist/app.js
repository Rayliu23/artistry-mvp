import {analyze,validateImages} from './engine.js';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const riskClass=level=>({'低':'risk-low','注意':'risk-attention','中度':'risk-medium','高':'risk-high'}[level]);
let data,report=null,images=[],objectUrls=[];
const compare={before:null,after:null,beforeUrl:null,afterUrl:null};
const sources=new Map();
function sourceLink(id,label){const s=sources.get(id);if(!s)return node('span','來源未載入');const a=node('a',label||s.title);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function appendSources(parent,ids){const p=node('p',undefined,'citation');[...new Set(ids)].forEach((id,i)=>{if(i)p.append(' · ');p.append(sourceLink(id));});parent.append(p);}
function appendSingleSource(parent,ids){const first=[...new Set(ids)][0];if(!first)return;const p=node('p',undefined,'citation');p.append(sourceLink(first));parent.append(p);}
function stale(){if(report){$('result-meta').textContent='內容已修改，請重新預檢';$('report').replaceChildren(node('p','內容已變更。重新預檢後才會顯示最新結果。','stale'));report=null;}}
const samples={official:'撫平皺紋，膚質光滑細緻，重現透亮年輕。',duration:'使用12週，肌膚看起來更加平滑，皺紋明顯減少。',high:'雅芝A醇抗皺精華刺激膠原蛋白大量增生，12週徹底消除皺紋。'};
document.querySelectorAll('[data-sample]').forEach(b=>b.addEventListener('click',()=>{$('copy').value=samples[b.dataset.sample];$('copy').dispatchEvent(new Event('input'));$('copy').focus();}));
$('copy').addEventListener('input',()=>{$('count').textContent=`${$('copy').value.length.toLocaleString()} / 10,000`;stale();});
function clearImages(){objectUrls.forEach(URL.revokeObjectURL);objectUrls=[];images=[];$('image-list').replaceChildren();$('images').value='';$('clear-images').hidden=true;stale();}
$('clear-images').addEventListener('click',clearImages);
$('images').addEventListener('change',()=>{
 const files=[...$('images').files];objectUrls.forEach(URL.revokeObjectURL);objectUrls=[];images=[];$('image-list').replaceChildren();stale();$('form-error').textContent='';
 try{images=validateImages(files);files.forEach((file,i)=>{const div=node('div',undefined,'image-item'),img=node('img');img.alt=`待分析圖片：${file.name}`;const url=URL.createObjectURL(file);objectUrls.push(url);img.src=url;img.onerror=()=>{$('form-error').textContent='圖片無法解碼，請移除並重新選擇有效圖片。';images[i].processing_status='invalid';};div.append(img,node('div',file.name),node('div','尚未分析'));$('image-list').append(div);});$('clear-images').hidden=!files.length;}
 catch(e){$('form-error').textContent=e.message;$('images').value='';$('clear-images').hidden=true;}
});
function loadCompareImage(file,side){if(!file)return; if(!['image/jpeg','image/png','image/webp'].includes(file.type)){ $('compare-metrics').textContent='圖片僅接受 JPG、PNG 或 WebP。'; return; } if(file.size>10*1024*1024){$('compare-metrics').textContent='每張圖片不可超過10 MB。';return;} const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{compare[side]=img;compare[side+'Url']=url;if(compare.before&&compare.after)drawCompare();};img.onerror=()=>{$('compare-metrics').textContent='圖片無法讀取，請重新選擇。';URL.revokeObjectURL(url);};img.src=url;}
function drawCompare(){const a=compare.before,b=compare.after,canvas=$('compare-canvas'),stage=$('compare-stage');const width=720,height=Math.round(width*Math.max(a.height/a.width,b.height/b.width));canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');const slider=Number($('compare-slider').value)/100;ctx.clearRect(0,0,width,height);ctx.drawImage(b,0,0,width,height);ctx.save();ctx.beginPath();ctx.rect(0,0,width*slider,height);ctx.clip();ctx.drawImage(a,0,0,width,height);ctx.restore();stage.hidden=false;$('compare-slider').disabled=false;$('clear-compare').hidden=false;$('compare-value').value=`${Math.round(slider*100)}%`;$('compare-value').textContent=`${Math.round(slider*100)}%`;compareMetrics(a,b);}
function compareMetrics(a,b){const size=64,ca=document.createElement('canvas'),cb=document.createElement('canvas');ca.width=cb.width=ca.height=cb.height=size;const xa=ca.getContext('2d'),xb=cb.getContext('2d');xa.drawImage(a,0,0,size,size);xb.drawImage(b,0,0,size,size);const pa=xa.getImageData(0,0,size,size).data,pb=xb.getImageData(0,0,size,size).data;let total=0;for(let i=0;i<pa.length;i+=4)total+=(Math.abs(pa[i]-pb[i])+Math.abs(pa[i+1]-pb[i+1])+Math.abs(pa[i+2]-pb[i+2]))/3;const pct=Math.min(100,total/(size*size*255)*100);$('compare-metrics').textContent=`像素差異估算：${pct.toFixed(1)}% · 僅供前後影像檢視，不代表功效、醫療效果或法規結論。`;}
['before','after'].forEach(side=>{const input=$(`compare-${side}`);input.addEventListener('change',()=>loadCompareImage(input.files[0],side));});
$('compare-slider').addEventListener('input',drawCompare);
$('clear-compare').addEventListener('click',()=>{for(const side of ['before','after']){if(compare[side+'Url'])URL.revokeObjectURL(compare[side+'Url']);compare[side]=null;compare[side+'Url']=null;$(`compare-${side}`).value='';}$('compare-stage').hidden=true;$('compare-slider').disabled=true;$('clear-compare').hidden=true;$('compare-metrics').textContent='尚未選擇兩張圖片。';});
function render(r){
 const root=$('report');root.replaceChildren();
 const banner=node('div',undefined,`result-banner ${riskClass(r.risk)}`);banner.append(node('h3',r.risk+'風險'),node('p',`${r.claims.length}個文字片段 · ${r.images.length}張圖片${r.images.length?'（未分析）':''}`),node('p',r.disclaimer));root.append(banner);
 const suggestion=node('section',undefined,'suggestion');
 suggestion.append(node('h3','建議發文修改'));
 const label=node('label','可編輯的建議文案');label.htmlFor='suggested-copy';
 const draft=node('textarea');draft.id='suggested-copy';draft.rows=4;draft.maxLength=10000;draft.value=r.suggestion.text;
 const apply=node('button','套用後重新預檢','secondary');apply.type='button';
 apply.addEventListener('click',()=>{const text=draft.value;if(!text.trim())return draft.focus();$('copy').value=text;$('copy').dispatchEvent(new Event('input'));$('check-form').requestSubmit();});
 const changes=node('details');changes.append(node('summary','查看修改說明'));const list=node('ul');
 r.suggestion.edits.forEach(e=>list.append(node('li',`「${e.original}」 → ${e.replacement?`「${e.replacement}」`:'未納入草稿'}。${e.reason}`)));changes.append(list);
 suggestion.append(label,draft,apply,node('p',r.suggestion.note,'small'),changes);appendSources(suggestion,r.suggestion.source_ids);root.append(suggestion);
 for(const f of r.global_findings){const box=node('div',undefined,`claim-card ${riskClass(f.level)}`);box.append(node('strong',f.level+'｜'+f.reason),node('p',f.basis));appendSingleSource(box,f.source_ids);root.append(box);}
 r.claims.forEach((claim,i)=>{
  const card=node('article',undefined,`claim-card ${riskClass(claim.risk)}`),title=node('div',undefined,'claim-title');title.append(node('h3',`${String(i+1).padStart(2,'0')}　${claim.text}`),node('span',claim.risk,'badge'));card.append(title);
  card.append(node('strong','風險與依據'));
  for(const f of claim.findings){card.append(node('p',f.reason),node('p',f.basis,'citation'));appendSingleSource(card,f.source_ids);}
  root.append(card);
 });
 $('result-meta').textContent=`${new Date(r.created_at).toLocaleTimeString('zh-TW')} · 文字預檢`;
}
$('check-form').addEventListener('submit',e=>{e.preventDefault();$('form-error').textContent='';try{if(images.some(i=>i.processing_status==='invalid'))throw new Error('請移除無法讀取的圖片。');report=analyze({text:$('copy').value,images},data);render(report);}catch(err){$('form-error').textContent=err.message;}});
try{
 const response=await fetch('./data/seed.json');if(!response.ok)throw new Error();data=await response.json();data.sources.forEach(s=>sources.set(s.id,s));
 $('submit').disabled=false;$('submit').textContent='開始文字預檢';
}catch{$('form-error').textContent='資料載入失敗，請重新整理。若從本機開啟，請依README啟動網站。';$('submit').textContent='無法載入資料';}
