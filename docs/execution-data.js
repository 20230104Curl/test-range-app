'use strict';
// Read the same saved records as the campus screen, including its legacy social key.
(function(root){
  function rowsFor(data,exam,grade,subject){
    const units=exam.subjects[subject].units[grade],allowed=units.map(u=>u[0]);
    const count=exam.selectionCounts?.[grade]?.[subject]||2;
    return data.schools.filter(s=>(Array.isArray(s.grades)?s.grades:[1,2,3]).includes(Number(grade))).map(s=>{
      const base=s.id+':'+grade;
      const record=subject==='social'?(data.records[base]??data.records[base+':social']):data.records[base+':'+subject];
      const result={id:s.id,name:s.name,codes:[],text:'',state:'pending'};
      if(!record)return result;
      const codes=record.codes,alternate=record.kind==='alternate';
      const valid=Array.isArray(codes)&&new Set(codes).size===codes.length&&codes.every(c=>allowed.includes(c))&&
        (alternate?codes.length<count&&typeof record.text==='string'&&record.text.trim().length>0&&record.text.length<=500:codes.length===count);
      if(!valid)return {...result,state:'invalid'};
      return {...result,state:alternate?'alternate':'selected',codes:allowed.filter(c=>codes.includes(c)),text:alternate?record.text.trim():''};
    });
  }
  if(typeof module==='object'&&module.exports)module.exports={rowsFor};
  else root.ExecutionData={rowsFor};
})(typeof window==='object'?window:globalThis);
