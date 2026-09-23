import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {analyze,splitClaims,validateImages} from '../dist/engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data/seed.json',import.meta.url)));
const run=(text,extra={})=>analyze({text,...extra},data);
const cases=[
 ['刺激膠原蛋白大量增生','高','R-COLLAGEN'],
 ['促進膠原蛋白合成','高','R-COLLAGEN'],
 ['膠原蛋白大量再生','高','R-COLLAGEN'],
 ['12週','注意','R-TIME-CONTEXT'],
 ['使用12週，撫平皺紋','中度','R-QUANTIFIED'],
 ['１２週撫平皺紋','中度','R-QUANTIFIED'],
 ['十二週撫平皺紋','中度','R-QUANTIFIED'],
 ['徹底消除皺紋','高','R-ERASE'],
 ['12週徹底消除皺紋','高','R-ERASE'],
 ['皺紋完全消失','高','R-ERASE'],
 ['撫平皺紋','低','R-BASELINE'],
 ['膚質光滑細緻','低','R-BASELINE'],
 ['肌膚摸起來更滑順','注意','R-PARAPHRASE'],
 ['淡化細紋','注意','R-PARAPHRASE'],
 ['5倍A醇效能','中度','R-QUANTIFIED'],
 ['7次有感撫紋','中度','R-QUANTIFIED'],
 ['7天有感撫紋','中度','R-QUANTIFIED'],
 ['9倍A醇效能','中度','R-QUANTIFIED'],
 ['促進真皮層膠原蛋白大量增生','高','R-COLLAGEN'],
 ['深入真皮層修復肌膚','高','R-STRUCTURE'],
 ['治療濕疹','高','R-MEDICAL'],
 ['完全安全零風險','中度','R-ABSOLUTE'],
 ['不能消除皺紋','注意','R-ERASE'],
 ['不會不消除皺紋','高','R-ERASE'],
 ['喜歡今天的保養時光','注意','R-COVERAGE'],
 ['量子重塑肌底','注意','R-COVERAGE'],
 ['消除，皺紋','高','R-ERASE'],
 ['刺激膠原蛋白\n大量增生','高','R-COLLAGEN'],
 ['#消除皺紋','高','R-ERASE']
];
for(const [text,risk,rule] of cases)test(`${text} → ${risk}`,()=>{const r=run(text);assert.equal(r.risk,risk);assert.ok([...r.claims.flatMap(c=>c.findings),...r.global_findings].some(f=>f.rule_id===rule));});
test('source offsets preserve original unicode text',()=>{const text='  肌膚細緻，12週。\n刺激膠原蛋白大量增生';for(const c of splitClaims(text))assert.equal(text.slice(c.start,c.end),c.text);});
test('unknown product, platform, empty and long text rejected',()=>{for(const args of [{text:''},{text:'   '},{text:'x'.repeat(10001)},{text:'hi',product_id:'wrong'},{text:'hi',platform:'X'}])assert.throws(()=>analyze(args,data));});
test('related matches never certify whole-sentence equivalence',()=>assert.equal(run('肌膚摸起來更滑順').claims[0].official.status,'related'));
test('numeric change is not official support',()=>assert.notEqual(run('12週撫平皺紋').claims[0].official.status,'exact'));
test('source absence is explicitly bounded',()=>assert.match(run('刺激膠原蛋白大量增生').claims[0].official.note,/不等於官方從未/));
test('official match does not override independent legal rules',()=>{const modified=structuredClone(data);modified.claims.push({...data.claims[0],id:'TEST',text:'消除皺紋'});assert.equal(analyze({text:'消除皺紋'},modified).risk,'高');});
test('historical rules never participate',()=>{const modified=structuredClone(data);modified.rules.push({...data.rules[0],id:'H-TEST',patterns:['光滑'],status:'historical_inactive'});assert.equal(analyze({text:'膚質光滑細緻'},modified).risk,'低');});
test('packaging rules do not judge social copy',()=>{const modified=structuredClone(data);modified.rules.push({...data.rules[0],id:'LABEL-TEST',patterns:['光滑'],scope:'packaging_label'});assert.equal(analyze({text:'膚質光滑細緻'},modified).risk,'低');});
test('images only and text with images cannot return low',()=>{const images=validateImages([{name:'test.jpg',type:'image/jpeg',size:1024}]);for(const text of ['','膚質光滑細緻']){const r=run(text,{images});assert.equal(r.risk,'注意');assert.equal(r.coverage,'text_only_images_pending');assert.equal(r.images[0].ocr_text,null);}});
test('file count, type and size limits',()=>{assert.throws(()=>validateImages([{type:'image/svg+xml',size:10}]));assert.throws(()=>validateImages([{type:'image/jpeg',size:11*1024*1024}]));assert.throws(()=>validateImages(Array(5).fill({type:'image/png',size:100})));assert.throws(()=>validateImages([{type:'image/png',size:0}]));});
test('every report citation resolves and pins snapshot hash',()=>{const r=run('12週徹底消除皺紋，刺激膠原蛋白大量增生');assert.ok(r.citations.length);for(const ref of r.source_versions){assert.match(ref.sha256,/^[a-f0-9]{64}$/);assert.ok(data.sources.find(s=>s.id===ref.source_id&&s.version_id===ref.version_id));}});
test('Product #0001 only and official Taiwan claim domains',()=>{assert.equal(data.products.length,1);for(const c of data.claims){assert.equal(c.product_id,'ART-TW-0001');const s=data.sources.find(s=>s.id===c.source_id);assert.ok(['www.amway.com.tw','shop.amway.com.tw'].includes(new URL(s.url).hostname));}});
test('all dataset references and regex patterns valid',()=>{const sourceIds=new Set(data.sources.map(s=>s.id)),versions=new Set(data.versions.map(v=>v.id));for(const e of [...data.products,...data.claims,...data.evidence,...data.rules,...data.sources]){assert.ok(versions.has(e.version_id));for(const id of (e.source_ids||[e.source_id]).filter(Boolean))assert.ok(sourceIds.has(id));}for(const r of data.rules)for(const p of r.patterns)new RegExp(p,'u');for(const c of data.claims)for(const id of c.evidence_ids)assert.ok(data.evidence.some(e=>e.id===id));});
test('source downloads are nonempty, correct format and hash verified',()=>{for(const source of data.sources){const raw=fs.readFileSync(new URL('../'+source.snapshot_path,import.meta.url));assert.ok(raw.length>1000);assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);if(source.snapshot_path.endsWith('.pdf'))assert.equal(raw.subarray(0,4).toString(),'%PDF');}});
test('historical dataset is physically separated',()=>{const history=JSON.parse(fs.readFileSync(new URL('../dist/data/historical.json',import.meta.url)));assert.equal(history.excluded_from_scoring,true);assert.ok(history.records.every(r=>r.status==='historical_inactive'));assert.equal(data.rules.some(r=>r.source_ids.includes('historical-phrases')),false);});
test('evidence gaps cannot silently become verified studies',()=>{for(const e of data.evidence){assert.equal(e.availability,'not_obtained');assert.equal(e.sample_size,null);assert.equal(e.duration,null);}});
test('all platform inputs are treated as public social posts',()=>{for(const platform of [undefined,'FB','IG','LINE','PUBLIC_SOCIAL'])assert.equal(run('撫平皺紋',{platform}).platform,'PUBLIC_SOCIAL');});
test('rewrite removes unverified time and absolute wrinkle promise',()=>{const r=run('刺激膠原蛋白大量增生，12週徹底消除皺紋');assert.doesNotMatch(r.suggestion.text,/12|徹底|消除|膠原|皺紋/);assert.match(r.suggestion.text,/柔嫩|舒適/);assert.equal(r.suggestion.edits.length,2);assert.ok(r.suggestion.edits.every(e=>e.replacement));assert.notEqual(run(r.suggestion.text).risk,'高');});
test('duration paraphrase uses conservative cosmetic wording',()=>{const r=run('使用12週，肌膚看起來更加平滑，皺紋明顯減少');assert.doesNotMatch(r.suggestion.text,/12週|明顯減少|皺紋/);assert.match(r.suggestion.text,/持續保養|良好狀態/);});
test('unknown text gets a rule-based cosmetic rewrite',()=>{const r=run('我用了三天，濕疹已根治');assert.doesNotMatch(r.suggestion.text,/我|根治|三天/);assert.ok(r.suggestion.edits.every(e=>e.replacement));});
test('text-only rewrite no longer carries an image reminder',()=>{const r=run('12週撫平皺紋');assert.equal(r.coverage,'text_only');assert.doesNotMatch(r.suggestion.note,/圖片尚未分析/);});
test('rewrite deduplicates and cites the current advertising rule',()=>{const r=run('光滑細緻，肌膚平滑');assert.equal((r.suggestion.text.match(/清爽柔嫩/g)||[]).length,1);assert.deepEqual(r.suggestion.source_ids,['advertising-rules']);});
