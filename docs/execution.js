'use strict';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const campus=params.get('campus'),order=['english','math','science','social','japanese'];
let grade=['1','2','3'].includes(params.get('grade'))?params.get('grade'):'1';
let subject=order.includes(params.get('subject'))?params.get('subject'):'english';
let exam,data=null,loading=false;
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function setStatus(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function updateURL(){params.set('grade',grade);params.set('subject',subject);history.replaceState(null,'','?'+params);}
function render(){
  document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.grade===grade)));
  document.querySelectorAll('[data-subject]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.subject===subject)));
  $('list-title').textContent=grade+'年生　'+exam.subjects[subject].name+'の選択単元';
  const common=exam.common?.[grade]?.[subject]||[];
  $('common').hidden=!common.length;
  $('common').textContent=common.length?'全中学校共通：'+common.map(u=>u[1]).join('・')+' ＋ 選択'+(exam.selectionCounts?.[grade]?.[subject]||2)+'題':'';
  const rows=data?ExecutionData.rowsFor(data,exam,grade,subject):[];
  $('rows').replaceChildren();
  for(const row of rows){
    const tr=node('tr'),school=node('th',row.name),cell=node('td');school.scope='row';
    if(row.state==='pending')cell.append(node('span','未決定','pending'));
    else if(row.state==='invalid')cell.append(node('span','要確認','invalid'));
    else{
      const codes=node('div',undefined,'codes');row.codes.forEach(c=>codes.append(node('span',c,'code')));
      if(row.state==='alternate')codes.append(node('span','別版','alternate'));
      cell.append(codes);if(row.text)cell.append(node('p',row.text,'alternate-text'));
    }
    tr.append(school,cell);$('rows').append(tr);
  }
  $('table-wrap').hidden=!rows.length;$('empty').hidden=!data||!!rows.length;
  $('empty').textContent='この学年の中学校は登録されていません。';
  const decided=rows.filter(r=>['selected','alternate'].includes(r.state)).length;
  $('count').textContent=data?'全'+rows.length+'校 ／ 決定 '+decided+'校':'';
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
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{grade=b.dataset.grade;updateURL();if(exam)render();});
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
    render();await refresh();
  }catch{setStatus('範囲表を読み込めませんでした。「最新に更新」で再度お試しください。',true);$('refresh').disabled=false;}
}
init();
