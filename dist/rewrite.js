// Source-grounded template rewriting, not a general-purpose language model.
export function suggestRewrite(report) {
 const edits=[];
 for(const claim of report.claims){
  const ids=claim.findings.map(f=>f.rule_id);
  const unsafe=claim.risk!=='低'||ids.some(id=>['R-ERASE','R-COLLAGEN','R-STRUCTURE','R-MEDICAL','R-QUANTIFIED'].includes(id));
  edits.push({original:claim.text,replacement:unsafe?null:'肌膚感覺清爽柔嫩',reason:unsafe?'移除可能涉及醫療、生理作用、絕對化或未佐證數據的宣稱，不自行補寫同等功效。':'改成較保守的外觀與使用感受描述，移除未確認的期間、數值、程度或生理作用。'});
 }
 return {method:'tfda_conservative_template_v1',text:'肌膚感覺清爽柔嫩，維持肌膚舒適與良好狀態。',edits,source_ids:['advertising-rules'],note:'這是依現行化粧品廣告風險規則整理的較低風險建議稿，不是TFDA核准或法律保證；請確認內容符合實際情況。'+(report.images.length?'圖片尚未分析，仍需確認圖文整體表達。':'')};
}
