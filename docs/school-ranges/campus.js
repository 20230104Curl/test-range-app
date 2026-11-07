/* Shared, read-only campus directory from the existing mock-test app. */
(function(root){
  'use strict';
  const KEY='school-ranges-campus-v1';
  function normalizeName(value){return String(value||'').normalize('NFKC').replace(/[\s　]/g,'').replace(/中学校$/,'中');}
  // Existing Chikusa records use the shortened name; keep this exception local.
  const aliases={'chikusa-honbu':{'名古屋城山中':['城山中']}};
  function readSchools(result){
    if(result.data===null)return [];
    const rows=result.data?.schools;
    if(!Array.isArray(rows)||rows.some(s=>!s||typeof s.id!=='string'||!s.id||typeof s.name!=='string'||!s.name.trim()||!Array.isArray(s.grades)||s.grades.some(g=>![1,2,3].includes(g))))throw Error('中学校情報の形式を確認できませんでした。');
    if(new Set(rows.map(s=>s.id)).size!==rows.length)throw Error('中学校情報に重複があります。');
    return rows.map(s=>({id:s.id,name:s.name,grades:[...s.grades],municipality:s.municipality||s.city||''}));
  }
  function matchingSchool(test,schools,campus){
    const refs=test.schoolRefs;
    const ref=Array.isArray(refs)?refs.find(r=>r.campusId===campus):null;
    if(Array.isArray(refs)&&refs.length&&!ref)return null;
    if(Array.isArray(test.campusIds)&&test.campusIds.length&&!test.campusIds.includes(campus))return null;
    const candidates=schools.filter(s=>{
      if(!s.grades.includes(test.grade))return false;
      const city=test.municipality||test.schoolMunicipality;
      if(city&&s.municipality&&normalizeName(city)!==normalizeName(s.municipality))return false;
      if(ref)return ref.schoolId===s.id;
      const name=normalizeName(test.school),target=normalizeName(s.name);
      return name===target||(aliases[campus]?.[target]||[]).includes(name);
    });
    return candidates.length===1?candidates[0]:null;
  }
  function scopedTests(tests,schools,campus){return tests.filter(t=>matchingSchool(t,schools,campus));}
  function initialCampus(search,storage,names){
    const requested=new URLSearchParams(search).get('campus');
    if(requested!==null)return Object.hasOwn(names,requested)?requested:'';
    try{const saved=storage.getItem(KEY);return Object.hasOwn(names,saved)?saved:'';}catch{return '';}
  }
  async function request(url,body,fetcher=fetch){
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw Error('校舎情報の接続先が未設定です。');
    if(!['catalog','state'].includes(body.action))throw Error('校舎情報は読み取り専用です。');
    const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},credentials:'omit',redirect:'follow',body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('校舎情報を読み込めませんでした。');
    const result=await response.json();
    if(result.status!==200||result.error)throw Error('校舎情報を読み込めませんでした。');
    return result;
  }
  async function loadSchools(url,campus,fetcher){
    // Resolve the active exam each time, including after an exam rollover.
    for(let attempt=0;attempt<2;attempt++){
      const catalog=await request(url,{action:'catalog'},fetcher);
      if(typeof catalog.exam?.id!=='string'||!catalog.exam.id)throw Error('校舎情報の対象回を確認できませんでした。');
      try{return {schools:readSchools(await request(url,{action:'state',campus,exam:catalog.exam.id},fetcher)),exam:catalog.exam.id};}
      catch(error){if(attempt||error.name==='TimeoutError')throw error;}
    }
  }
  const api={KEY,normalizeName,readSchools,matchingSchool,scopedTests,initialCampus,request,loadSchools};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusDirectory=api;
})(typeof window==='object'?window:globalThis);
