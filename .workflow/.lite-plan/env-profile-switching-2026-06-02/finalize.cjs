var fs=require("fs");
var t="D:/Gawean Rebinmas/PORTAL_ESTATE/Plantware_Auto_Report/Daftar_Upah_baru/payroll_daftar_upah/refactor_production/.workflow/.lite-plan/env-profile-switching-2026-06-02/exploration-dependencies.json";
var d=JSON.parse(fs.readFileSync(t,"utf8"));
d.relevant_files=[
  {"path":"backend/src/index.ts","relevance":1.0,"rationale":"Entry point. Must conditionally register stagingRoutes.","role":"modify_target","discovery_source":"bash-scan","topic_relation":"Primary target: add DISABLE_STAGING_DB guard."},
  {"path":"backend/src/config.ts","relevance":1.0,"rationale":"Config source. DB_STAGING_DATABASE+PROFILE exist, DISABLE_STAGING_DB missing.","role":"modify_target","discovery_source":"bash-scan","topic_relation":"Must add DISABLE_STAGING_DB boolean."},
  {"path":"backend/.env","relevance":0.95,"rationale":"Env source. DISABLE_STAGING_DB=true L42 never consumed.","role":"config","discovery_source":"bash-scan","topic_relation":"DISABLE_STAGING_DB=true needs code support."},
  {"path":"backend/src/api/stagingRoutes.ts","relevance":0.90,"rationale":"20 endpoints. Singletons L6-7 import side-effect.","role":"modify_target","discovery_source":"bash-scan","topic_relation":"Singletons bypass route guard."},
  {"path":"backend/src/db/client.ts","relevance":0.85,"rationale":"DB factory. getStagingInstance L87-89 no DISABLE guard.","role":"modify_target","discovery_source":"bash-scan","topic_relation":"Defense-in-depth location."},
  {"path":"backend/src/services/additional_service/explore_staging/stagingExplorerService.ts","relevance":0.80,"rationale":"Explorer service. Constructor creates stagingDb.","role":"dependency","discovery_source":"dependency-trace","topic_relation":"Dependency leaf."},
  {"path":"backend/src/services/additional_service/explore_staging/stagingComparisonService.ts","relevance":0.80,"rationale":"Largest staging consumer (15+ methods).","role":"dependency","discovery_source":"dependency-trace","topic_relation":"All comparison endpoints depend on staging."},
  {"path":"frontend/src/services/stagingComparisonService.js","relevance":0.70,"rationale":"Frontend client (8 fetch functions).","role":"integration_point","discovery_source":"bash-scan","topic_relation":"Needs clear error when staging disabled."},
  {"path":"frontend/src/pages/StagingComparisonPage.jsx","relevance":0.70,"rationale":"Pivot matrix page.","role":"integration_point","discovery_source":"bash-scan","topic_relation":"Needs graceful degraded state."},
  {"path":"backend/src/services/additional_service/explore_staging/stagingComparisonService.test.ts","relevance":0.65,"rationale":"4 test cases hitting staging DB.","role":"test_target","discovery_source":"bash-scan","topic_relation":"Needs skip guard when DISABLE_STAGING_DB=true."},
  {"path":"frontend/src/pages/StagingDaftarUpahPage.jsx","relevance":0.60,"rationale":"Daftar Upah staging page.","role":"context_only","discovery_source":"bash-scan","topic_relation":"Lower priority consumer."},
  {"path":"frontend/src/pages/StagingEmployeeDetailModal.jsx","relevance":0.55,"rationale":"Employee detail modal.","role":"context_only","discovery_source":"bash-scan","topic_relation":"Leaf consumer."},
  {"path":"docs/STAGING_VS_DBPTRJ_MAPPING.md","relevance":0.45,"rationale":"Docs confirming SERVER_PROFILE_2 is staging.","role":"context_only","discovery_source":"bash-scan","topic_relation":"Confirms staging profile."}
];
fs.writeFileSync(t,JSON.stringify(d,null,2));
console.log("Done: "+JSON.stringify(d).length+" bytes");
