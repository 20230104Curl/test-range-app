'use strict';
(function(root){
  const names={english:'英語',math:'数学',science:'理科',social:'社会',japanese:'国語'},ids=Object.keys(names),grades=['1','2','3'];
  function metadata(exam){const m=String(exam.id||'').match(/^(\d{4})-([1-5])/);return {year:exam.year||(m?Number(m[1]):new Date().getFullYear()),round:exam.round||(m?Number(m[2]):1)};}
  function blank(active){const meta=metadata(active);return {year:meta.year+(meta.round===5?1:0),round:meta.round===5?1:meta.round+1,subjects:Object.fromEntries(ids.map(id=>[id,{name:names[id],units:{'1':[],'2':[],'3':[]}}])),common:{},selectionCounts:{}};}
  function panelErrors(exam,grade,id){
    const errors=[],label=grade+'年 '+names[id],units=exam.subjects?.[id]?.units?.[grade],common=exam.common?.[grade]?.[id]||[],count=exam.selectionCounts?.[grade]?.[id]??2;
    if(!Number.isInteger(count)||count<1||count>5)errors.push(label+'：選択数は１〜５題にしてください。');
    if(!Array.isArray(units)||units.length<count||units.length>26)errors.push(label+'：選択数以上の単元を登録してください（最大26単元）。');
    if(!Array.isArray(common)||common.length>10)errors.push(label+'：共通単元は10件までです。');
    const seen=new Set();
    for(const [list,shared] of [[units,false],[common,true]]){
      if(!Array.isArray(list))continue;
      for(const u of list){
        if(!Array.isArray(u)||u.length!==5||u.some(x=>typeof x!=='string')){errors.push(label+'：単元の形式を確認してください。');continue;}
        if(shared?u[0]!=='共通':(!/^[A-Z]$/.test(u[0])||seen.has(u[0])))errors.push(label+'：記号は重複しないA〜Z、または「共通」にしてください。');
        if(!shared)seen.add(u[0]);
        if(!u[1].trim()||u[1].length>500||u.slice(2).some(x=>x.length>300))errors.push(label+'：単元名・教材ページを確認してください。');
      }
    }
    return [...new Set(errors)];
  }
  function errors(exam){
    if(!exam||typeof exam!=='object')return ['範囲表を入力してください。'];
    const result=[];
    if(!Number.isInteger(exam.year)||exam.year<2020||exam.year>2100)result.push('年度は2020〜2100年で入力してください。');
    if(!Number.isInteger(exam.round)||exam.round<1||exam.round>5)result.push('回数は第１回〜第５回で選んでください。');
    for(const g of grades)for(const id of ids)result.push(...panelErrors(exam,g,id));
    return result;
  }
  function title(exam){return exam.year+'年 第'+String.fromCharCode(0xff10+exam.round)+'回 定期テスト模擬';}
  function normalize(exam){return {year:exam.year,round:exam.round,title:title(exam),subjects:Object.fromEntries(ids.map(id=>[id,{name:names[id],units:Object.fromEntries(grades.map(g=>[g,exam.subjects[id].units[g].map(u=>u.map(v=>v.trim()))]))}])),common:Object.fromEntries(grades.map(g=>[g,Object.fromEntries(ids.map(id=>[id,(exam.common?.[g]?.[id]||[]).map(u=>u.map(v=>v.trim()))]))])),selectionCounts:Object.fromEntries(grades.map(g=>[g,Object.fromEntries(ids.map(id=>[id,exam.selectionCounts?.[g]?.[id]??2]))]))};}
  // Excel TSV includes quoted cells when a unit name contains a line break.
  function cells(text){
    const rows=[];let row=[],cell='',quoted=false;
    text=text.replace(/\r\n?/g,'\n');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(!quoted&&(c==='\t'||c==='\n')){row.push(cell);cell='';if(c==='\n'){rows.push(row);row=[];}}
      else cell+=c;
    }
    if(quoted)throw Error('引用符が閉じられていないセルがあります。貼り付け範囲を確認してください。');
    row.push(cell);rows.push(row);return rows.filter(r=>r.some(v=>v.trim()));
  }
  function parse(text){
    let next=0;const units=[],common=[];
    for(const cellsRow of cells(text)){
      const cols=cellsRow.map(v=>v.trim());
      if(['記号','単元名','単元'].includes(cols[0]))continue;
      let code='',name='',page='';
      const first=cols[0].normalize('NFKC').toUpperCase(),prefix=cols[0].match(/^([A-Za-zＡ-Ｚａ-ｚ]|共通)[：:\s]+(.+)$/s);
      if(/^(?:[A-Z]|共通)$/.test(first)){code=first;name=cols[1]||'';page=cols.slice(2).join('　');}
      else if(prefix){code=prefix[1].normalize('NFKC').toUpperCase();name=prefix[2];page=cols.slice(1).join('　');}
      else {code=String.fromCharCode(65+next);name=cols[0];page=cols.slice(1).join('　');}
      const u=[code,name,'','',page];
      if(code==='共通')common.push(u);else{units.push(u);next=Math.max(next,code.charCodeAt(0)-64);}
    }
    if(!units.length&&!common.length)throw Error('単元を貼り付けてください。');
    if(units.length>26||common.length>10)throw Error('選択単元は26件、共通単元は10件までです。');
    return {units,common};
  }
  const api={names,ids,grades,metadata,blank,panelErrors,errors,title,normalize,parse};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ExamModel=api;
})(typeof window==='object'?window:globalThis);
