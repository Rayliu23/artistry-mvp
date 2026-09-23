// Source-grounded template rewriting, not a general-purpose language model.
export function suggestRewrite(report) {
 const edits=[];
 for(const claim of report.claims){
  const ids=claim.findings.map(f=>f.rule_id);
  const medical=ids.some(id=>['R-COLLAGEN','R-STRUCTURE','R-MEDICAL'].includes(id));
  const absolute=ids.includes('R-ERASE');
  const quantified=ids.includes('R-QUANTIFIED');
  const replacement=medical?'日常保養，讓肌膚維持柔嫩舒適。':absolute?'讓肌膚看起來更平滑。':quantified?'持續保養，讓肌膚維持良好狀態。':'肌膚感覺清爽柔嫩。';
  edits.push({original:claim.text,replacement,reason:medical?'依認定準則，移除涉及生理機轉或醫療效果的描述，改用一般保養與外觀感受。':absolute?'依認定準則，移除「徹底、完全、消除」等絕對化結果，改用外觀描述。':quantified?'依認定準則，移除未附佐證的期間、倍數或效果數據，改用一般保養描述。':'依認定準則，保留較保守的肌膚外觀與使用感受文字。'});
 }
 const text=edits.length?[...new Set(edits.map(e=>e.replacement))].join('，'):'肌膚感覺清爽柔嫩。';
 return {method:'tfda_rule_based_rewrite_v2',text,edits,source_ids:['advertising-rules'],note:'這是依現行化粧品廣告認定準則整理的較低風險建議稿，不是TFDA核准或法律保證；請確認內容符合實際情況。'};
}
