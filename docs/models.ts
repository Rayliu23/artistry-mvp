/** Documentation contract: JSON seed is the persisted MVP database. No personal drafts are stored. */
export type Risk = '低' | '注意' | '中度' | '高';
export type ID = string;
export interface Version {
 id: ID; entity_type: 'product'|'official_claim'|'evidence'|'source'|'risk_rule';
 version: string; supersedes: ID|null; created_at: string; change_note: string;
}
export interface Source {
 id: ID; title: string; url: string; publisher: string;
 kind: 'amway_official'|'government_official'; status: 'current'|'historical_inactive'|'draft';
 retrieved_at: string; checked_at: string; effective_from: string|null;
 version: string; version_id: ID; snapshot_path: string; sha256: string;
 capture_method: 'http_download'; coverage: string;
}
export interface Product {
 id: ID; number: string; brand: string; series: string; name: string; name_en: string;
 product_code: string; volume: string; market: 'TW'; category: string; regulatory_category: string;
 status: 'listed'|'discontinued'|'unknown'; official_url: string;
 source_ids: ID[]; version_id: ID; first_seen: string; last_checked: string;
}
export interface OfficialClaim {
 id: ID; product_id: ID; text: string; concept: string; source_id: ID; locator: string;
 conditions: string[]; evidence_ids: ID[]; status: 'current'|'superseded'; version_id: ID;
}
export interface Evidence {
 id: ID; product_id: ID; claim_ids: ID[]; source_id: ID;
 kind: 'official_marketing_statement'|'test_report'; availability: 'not_obtained'|'partial'|'verified';
 summary: string; study_type: string|null; sample_size: number|null; duration: string|null;
 comparator: string|null; result: string|null; limitations: string[]; version_id: ID;
}
export interface TFDARule {
 id: ID; status: 'current'|'historical_inactive'; scope: 'advertising'|'packaging_label';
 level: Risk; patterns: string[]; reason: string; basis: string; source_ids: ID[];
 interpretation: 'pattern_expansion'|'editorial_heuristic'; version_id: ID;
}
export interface LegalReference {
 id: ID; source_id: ID; articles: string[]; status: 'current'|'historical_inactive';
 scope: 'advertising'|'packaging_label'; summary: string;
}
export interface HistoricalPhraseRecord {
 id: ID; title: string; status: 'historical_inactive'; source_id: ID;
 stop_notice_source_id: ID; notice_issued_on: string; notice_published_on: string;
 effective_to: string; note: string;
}
export interface ImageAttachment {
 id: ID; filename: string; mime_type: 'image/jpeg'|'image/png'|'image/webp'; size_bytes: number;
 processing_status: 'pending_ocr'|'invalid'; ocr_text: null; visual_claims: [];
 storage: 'browser_memory_only';
}
export interface ImageComparison {
 id: ID; before_filename: string; after_filename: string;
 mode: 'client_canvas_slider'; split_percent: number; pixel_difference_percent: number|null;
 processing_status: 'ready'|'pending'|'invalid'; storage: 'browser_memory_only';
 disclaimer: string;
}
export interface Finding { rule_id: ID; level: Risk; reason: string; basis: string; source_ids: ID[] }
export interface ExtractedClaim {
 id: ID; text: string; start: number; end: number; context: string; sentence_start: number;
 official: {
  status: 'exact'|'related'|'extended'|'not_found'|'context_review';
  method: 'controlled_semantics_v1'; concepts: string[]; searched_source_ids: ID[];
  matched_claims: Pick<OfficialClaim,'id'|'text'|'source_id'|'locator'|'conditions'|'evidence_ids'>[];
  unsupported_quantity: boolean; note: string;
 };
 findings: Finding[]; risk: Risk;
}
export interface PrecheckReport {
 id: ID; created_at: string; product_id: ID; platform: 'PUBLIC_SOCIAL'; text: string;
 images: ImageAttachment[]; comparison?: ImageComparison; claims: ExtractedClaim[]; global_findings: Finding[]; risk: Risk;
 coverage: 'text_only'|'text_only_images_pending'; dataset_version: string; engine_version: string;
 source_versions: {source_id: ID; version_id: ID; sha256: string}[]; citations: Source[]; disclaimer: string;
 suggestion: {method:'official_claim_template_v1';text:string;edits:{original:string;replacement:string|null;reason:string}[];source_ids:ID[];note:string};
}
