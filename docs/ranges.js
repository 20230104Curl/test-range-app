'use strict';
const params=new URLSearchParams(location.search);
let grade=['1','2','3'].includes(params.get('grade'))?params.get('grade'):'1';
let exam;
const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
function fitRange(){
  const grid=document.getElementById('subjects');
  let size=16;grid.style.setProperty('--range-font',size+'px');
  const available=window.innerHeight-grid.getBoundingClientRect().top-12;
  while(grid.getBoundingClientRect().height>available && size>6){size-=0.25;grid.style.setProperty('--range-font',size+'px');}
}
window.addEventListener('resize',()=>{if(exam)fitRange();});
function render(){
  document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.grade===grade)));
  const target=document.getElementById('subjects');target.replaceChildren();
  for(const ids of [['english','math','science'],['social','japanese']]){
    const column=make('div',null,'column');
    for(const id of ids){
      const subject=exam.subjects[id],common=exam.common?.[grade]?.[id]||[],count=exam.selectionCounts?.[grade]?.[id]||2;
      const section=make('section'),heading=make('h2',subject.name);
      heading.append(make('span',(common.length?'共通＋':'')+count+'題選択'));section.append(heading);
      const table=make('table');table.setAttribute('aria-label',grade+'年生 '+subject.name+'の範囲');
      const head=make('thead'),tr=make('tr');for(const title of ['記号','単元・ページ']){const th=make('th',title);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
      const body=make('tbody');
      for(const [index,u] of [...common,...subject.units[grade]].entries()){
        const row=make('tr',null,index<common.length?'common':'');const code=make('th',u[0]);code.scope='row';
        const cell=make('td',u[1]);if(u[4])cell.append(make('span',u[4],'pages'));row.append(code,cell);body.append(row);
      }
      table.append(body);section.append(table);column.append(section);
    }
    target.append(column);
  }
  requestAnimationFrame(fitRange);
}
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{grade=b.dataset.grade;params.set('grade',grade);history.replaceState(null,'','?'+params);if(exam)render();});
async function init(){
  try{
    exam=await CurrentExam.load();
    document.getElementById('exam-title').textContent=exam.title;document.title=exam.title+'｜範囲表一覧';render();document.getElementById('status').textContent='';
    const campus=params.get('campus');if(campus){const back=document.getElementById('back');back.href='index.html?'+new URLSearchParams({campus,view:'student'});back.textContent='中学校別へ';}
  }catch{document.getElementById('status').textContent='範囲表を読み込めませんでした。画面を再読み込みしてください。';}
}
document.fonts.ready.then(()=>{if(exam)fitRange();});
init();
