import {suggestRewrite} from './rewrite.js';
export const levels = ['低','注意','中度','高'];
export const normalize = text => text.normalize('NFKC').toLowerCase().replace(/週/g,'周').replace(/胶/g,'膠').replace(/纹/g,'紋').replace(/皱/g,'皺').replace(/彻/g,'徹').replace(/\s+/g,'');
const test = (pattern,text) => new RegExp(pattern,'u').test(text);
const highest = values => levels[Math.max(0,...values.map(x=>levels.indexOf(x)))];
const efficacy = /皺紋|細紋|紋路|撫紋|膠原|平滑|光滑|細緻|透亮|光澤|光采|明亮|效能|抗老|抗皺|改善|消除|保濕|美白|緊緻/;
const quantities = text => normalize(text).match(/(?:\d+(?:\.\d+)?|十二|七|五)(?:周|天|日|次|倍|%)/g)||[];

export function splitClaims(text) {
 const claims=[];
 // Retain sentence context for durations separated from the effect by commas.
 for(const sentence of text.matchAll(/[^。！？!?；;\n]+[。！？!?；;]?/gu)) {
  for(const part of sentence[0].matchAll(/[^，,、。！？!?；;]+/gu)) {
   const raw=part[0], trimmed=raw.trim();
   if(!trimmed) continue;
   const start=sentence.index+part.index+raw.indexOf(trimmed);
   claims.push({text:trimmed,start,end:start+trimmed.length,context:sentence[0].trim(),sentence_start:sentence.index});
  }
 }
 return claims;
}

function isNegated(text) {
 // Only anchored, narrow negations. Unknown quotation, double negatives and complex scope require review.
 return /^(?:本品|這款|此產品|它)?(?:不會|不能|無法|不具|並非|並不|不是)(?!不|沒|無法)/.test(normalize(text));
}

function matchOfficial(claim,product,data) {
 const n=normalize(claim.text);
 const eligible=data.claims.filter(c=>c.product_id===product.id&&c.status==='current');
 const concepts=data.concepts.filter(c=>c.patterns.some(p=>test(p,n)));
 const ids=new Set(concepts.flatMap(c=>c.claim_ids));
 const matches=eligible.filter(c=>ids.has(c.id)||n===normalize(c.text));
 const intensified=/(?:消除|根除|消失|徹底|永久|保證|完全|100%|膠原|真皮|細胞|治療)/.test(n);
 const q=quantities(claim.context);
 const unsupportedQuantity=q.length>0&&!matches.some(c=>q.every(value=>quantities(c.text).includes(value)));
 const exact=eligible.find(c=>n===normalize(c.text));
 let status=exact?'exact':matches.length?'related':'not_found';
 if(intensified||unsupportedQuantity) status=matches.length?'extended':'not_found';
 if(isNegated(claim.text)) status='context_review';
 return {status,method:'controlled_semantics_v1',searched_source_ids:product.source_ids,concepts:concepts.map(c=>c.id),matched_claims:matches.map(c=>({id:c.id,text:c.text,source_id:c.source_id,locator:c.locator,conditions:c.conditions,evidence_ids:c.evidence_ids})),unsupported_quantity:unsupportedQuantity,
  note:status==='exact'?'本句與已保存官方宣稱相同；仍須獨立檢查法規、條件與佐證。':status==='related'?'找到相近外觀／功效概念；這是受控同義語意比對，未證明整句等義或證據充分。':status==='extended'?'有相近官方概念，但時間、數字或程度延伸未獲目前資料支持。':status==='context_review'?'含否定語境，需核對整體表達。':'目前收錄的官方資料未找到相符宣稱；不等於官方從未宣稱或依法違規。'};
}

export function validateImages(files) {
 if(files.length>4) throw new Error('最多選擇4張圖片。');
 for(const file of files) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('圖片僅接受 JPG、PNG 或 WebP。');
  if(file.size<=0||file.size>10*1024*1024) throw new Error('每張圖片須大於0且不超過10 MB。');
 }
 return files.map((f,i)=>({id:`image-${i+1}`,filename:f.name,mime_type:f.type,size_bytes:f.size,processing_status:'pending_ocr',ocr_text:null,visual_claims:[],storage:'browser_memory_only'}));
}

export function analyze({text,product_id='ART-TW-0001',platform='PUBLIC_SOCIAL',images=[]},data) {
 if(typeof text!=='string'||(!text.trim()&&!images.length)) throw new Error('請輸入文案或選擇圖片。');
 if(text.length>10000) throw new Error('文案限10,000字以內。');
 if(!['PUBLIC_SOCIAL','FB','IG','LINE'].includes(platform)) throw new Error('不支援的社群平台。');
 const product=data.products.find(p=>p.id===product_id);
 if(!product) throw new Error('找不到產品，請重新選擇。');
 const active=data.rules.filter(r=>r.status==='current'&&r.scope==='advertising');
 const claims=splitClaims(text).map((part,index)=>{
  const n=normalize(part.text), official=matchOfficial(part,product,data), findings=[];
  const add=(id,level,reason,basis,source_ids)=>findings.push({rule_id:id,level,reason,basis,source_ids});
  for(const rule of active) if(rule.patterns.some(p=>test(p,n))) {
   const neg=isNegated(part.text);
   add(rule.id,neg?'注意':rule.level,neg?'此句可能在否定功效，未直接視為肯定宣稱；仍需人工確認否定範圍。':rule.reason,rule.basis,rule.source_ids);
  }
  const numeric=quantities(part.context);
  if(numeric.length&&efficacy.test(normalize(part.context))) {
   const proof=official.matched_claims.flatMap(c=>c.evidence_ids).map(id=>data.evidence.find(e=>e.id===id));
   const confirmed=proof.length&&proof.every(e=>e?.availability==='verified');
   if(!confirmed||official.unsupported_quantity) add('R-QUANTIFIED','中度','時間／次數／倍數與功效連用，需相同產品、期間、比較基準與測試條件的佐證；本次資料不足以確認。','認定準則第3條第2款；不是把時間數字列為禁詞',['advertising-rules']);
  } else if(quantities(part.text).length) {
   add('R-TIME-CONTEXT','注意','單獨時間或數字不直接表示違規；請確認是否與照片、前後段功效形成關聯。','認定準則第2條：整體表現',['advertising-rules']);
  }
  if(official.status==='not_found'&&!findings.length) add('R-COVERAGE','注意','此句需要依現行法規判斷整體語境；工具不提供品牌官方文案比對。','認定準則第2條：圖文整體表現',['advertising-rules']);
  if(official.status==='related'&&!findings.length) add('R-PARAPHRASE','注意','找到相近概念，但整句可能有額外意義；請核對官方原文與適用條件。','語意比對的不確定性',official.matched_claims.map(c=>c.source_id));
  if(!findings.length) add('R-BASELINE','低','已收錄官方原句，本次文字規則未發現較高風險；仍須確認真實性與整體表現。','認定準則第2、4條；附件二第六類例示',['advertising-rules','annex-2']);
  return {id:`claim-${index+1}`,...part,official,findings,risk:highest(findings.map(f=>f.level))};
 });
 // Check across clause/line boundaries, preventing punctuation from hiding a known risky statement.
 const compact=normalize(text).replace(/[，,、。！？!?；;「」『』“”"'：:]/g,'');
 const global_findings=[];
 for(const rule of active) {
  if(rule.patterns.some(p=>test(p,compact))&&!claims.some(c=>c.findings.some(f=>f.rule_id===rule.id)))
   global_findings.push({rule_id:rule.id,level:rule.level,reason:'跨分句偵測到可能風險，需連同完整文案覆核：'+rule.reason,basis:rule.basis,source_ids:rule.source_ids});
 }
 if(images.length) global_findings.push({rule_id:'R-IMAGE-PENDING',level:'注意',reason:'圖片尚未進行OCR或視覺分析；本次結果未涵蓋圖中文字、前後對照與整體視覺暗示。',basis:'認定準則第2條：圖文整體表現',source_ids:['advertising-rules']});
 const sourceIds=new Set([...claims.flatMap(c=>[...c.official.searched_source_ids,...c.findings.flatMap(f=>f.source_ids)]),...global_findings.flatMap(f=>f.source_ids)]);
 const report={id:globalThis.crypto.randomUUID(),created_at:new Date().toISOString(),product_id,platform:'PUBLIC_SOCIAL',text,images,claims,global_findings,
  risk:highest([...claims.map(c=>c.risk),...global_findings.map(f=>f.level)]),coverage:images.length?'text_only_images_pending':'text_only',
  dataset_version:data.dataset_version,engine_version:data.engine_version,source_versions:data.sources.filter(s=>sourceIds.has(s.id)).map(s=>({source_id:s.id,version_id:s.version_id,sha256:s.sha256})),
  citations:data.sources.filter(s=>sourceIds.has(s.id)),disclaimer:'本結果僅為有限規則的風險預檢，不是TFDA核准、合法保證或法律最終判定。官方語意相近不等於合規；未命中不等於無風險。'};
 report.suggestion=suggestRewrite(report,data);
 return report;
}
