'use strict';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const campus=params.get('campus'),order=['english','math','science','social','japanese'];
let subject=order.includes(params.get('subject'))?params.get('subject'):'english';
let exam,data=null,loading=false;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);scheduleFit();}
function updateURL(){params.delete('grade');params.set('subject',subject);history.replaceState(null,'','?'+params);}
let fitFrame;
function scheduleFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitRows);}
function fitRows(){
  const grid=$('grades');
  grid.style.setProperty('--list-height',Math.max(160,window.innerHeight-grid.getBoundingClientRect().top-16)+'px');
  // Fit each grade independently so short lists keep their large reading text.
  grid.querySelectorAll('.grade-content').forEach(content=>{
    let size=window.innerWidth<=700?16:20;
    content.style.setProperty('--row-font',size+'px');
    while(size>9&&(content.scrollHeight>content.clientHeight||content.scrollWidth>content.clientWidth)){
      size-=.5;content.style.setProperty('--row-font',size+'px');
    }
  });
}
window.addEventListener('resize',scheduleFit);
document.fonts.ready.then(scheduleFit);
function render(){
  document.querySelectorAll('[data-subject]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.subject===subject)));
  $('list-title').textContent=exam.subjects[subject].name+'の選択単元';
  $('grades').replaceChildren(...['1','2','3'].map(renderGrade));
  scheduleFit();
}
function renderGrade(grade){
  const panel=node('section',undefined,'grade-panel'),heading=node('div',undefined,'grade-heading');
  const title=node('h3',grade+'年生'),count=node('span',undefined,'count'),content=node('div',undefined,'grade-content');
  title.id='grade-'+grade;panel.setAttribute('aria-labelledby',title.id);heading.append(title,count);panel.append(heading,content);
  const common=exam.common?.[grade]?.[subject]||[];
  if(common.length)content.append(node('p','全中学校共通：'+common.map(u=>u[1]).join('・')+' ＋ 選択'+(exam.selectionCounts?.[grade]?.[subject]||2)+'題','common'));
  const rows=data?ExecutionData.rowsFor(data,exam,grade,subject):[];
  content.classList.toggle('compact',rows.length>10);
  const table=node('table'),head=node('thead'),headRow=node('tr'),body=node('tbody');
  table.setAttribute('aria-label',grade+'年生 '+exam.subjects[subject].name);
  ['中学校','選択単元'].forEach(label=>{const th=node('th',label);th.scope='col';headRow.append(th);});
  head.append(headRow);table.append(head,body);
  for(const row of rows){
    const tr=node('tr'),school=node('th',row.name),cell=node('td');school.scope='row';
    if(row.state==='pending')cell.append(node('span','未決定','pending'));
    else if(row.state==='invalid')cell.append(node('span','要確認','invalid'));
    else{
      const codes=node('div',undefined,'codes');row.codes.forEach(c=>codes.append(node('span',c,'code')));
      if(row.state==='alternate')codes.append(node('span','別版','alternate'));
      cell.append(codes);if(row.text)cell.append(node('p',row.text,'alternate-text'));
    }
    tr.append(school,cell);body.append(tr);
  }
  if(rows.length)content.append(table);
  else content.append(node('p',data?'この学年の中学校は登録されていません。':'読み込み待ち','empty'));
  const decided=rows.filter(r=>['selected','alternate'].includes(r.state)).length;
  count.textContent=data?'全'+rows.length+'校 ／ 決定 '+decided+'校':'';
  return panel;
}
async function refresh(){
  if(loading||!exam)return;loading=true;$('refresh').disabled=true;setStatus('読み込み中…');
  try{
    const response=await fetch('/api/state?'+new URLSearchParams({campus,exam:exam.id}));
    const result=await response.json();if(!response.ok)throw Error(result.error||'読み込めませんでした。');
    const next=result.data||{schools:[],records:{}};
    if(!Array.isArray(next.schools)||!next.records||typeof next.records!=='object')throw Error('保存内容を読み込めませんでした。');
    data=next;render();setStatus('取得時刻 '+new Date().toLocaleTimeString('ja-JP'));
  }catch{
    setStatus(data?'更新できませんでした。前回取得した内容を表示しています。「最新に更新」で再度お試しください。':'読み込めませんでした。「最新に更新」で再度お試しください。',true);
  }finally{loading=false;$('refresh').disabled=false;}
}
$('refresh').onclick=()=>exam?refresh():init();
async function init(){
  $('refresh').disabled=true;setStatus('読み込み中…');
  try{
    const [er,cr]=await Promise.all([fetch('exam.json',{cache:'no-store'}),fetch('campuses.json',{cache:'no-store'})]);
    if(!er.ok||!cr.ok)throw Error();
    const [catalog,campuses]=await Promise.all([er.json(),cr.json()]);
    if(!campus||!Object.hasOwn(campuses,campus)){
      setStatus('校舎一覧から校舎を選び、「実施用一覧」を開いてください。',true);$('back').hidden=true;return;
    }
    exam=catalog;$('exam-title').textContent=exam.title;
    $('page-title').textContent='実施用一覧【'+campuses[campus]+'】';document.title=$('page-title').textContent+'｜'+exam.title;
    $('back').href='index.html?'+new URLSearchParams({campus,view:'student'});
    $('subjects').replaceChildren(...order.map(id=>{const b=node('button',exam.subjects[id].name);b.dataset.subject=id;b.onclick=()=>{subject=id;updateURL();render();};return b;}));
    updateURL();render();await refresh();
  }catch{setStatus('範囲表を読み込めませんでした。「最新に更新」で再度お試しください。',true);$('refresh').disabled=false;}
}
init();
