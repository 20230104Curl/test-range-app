'use strict';
const $=id=>document.getElementById(id),M=ExamModel,campus='chikusa-honbu';
let active,draft,revision=0,activeRevision=0,grade='1',subject='english',changed=false,busy=false,finished=false;
const pending={};
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function message(id,text,error=false){$(id).textContent=text;$(id).className='status '+(error?'error':'success');}
async function api(action,payload={}){const r=await fetch('/api/'+action,{method:'POST',body:JSON.stringify({campus,...payload})});const result=await r.json();if(!r.ok)throw Error(result.error||'処理できませんでした。');return result;}
function confirmChange(text,label){return new Promise(resolve=>{const dialog=$('confirm-change');$('confirm-text').textContent=text;$('confirm-accept').textContent=label;dialog.returnValue='';dialog.onclose=()=>resolve(dialog.returnValue==='accept');dialog.showModal();});}
function mark(){changed=true;message('save-status','未保存の変更があります。');updateProgress();}
function panelKey(){return grade+':'+subject;}
function units(){return draft.subjects[subject].units[grade];}
function common(){draft.common[grade]??={};return draft.common[grade][subject]??=[];}
function setBusy(value){busy=value;document.querySelectorAll('#editor button,#editor input,#editor select,#editor textarea').forEach(e=>e.disabled=value);if(!value)updateProgress();}
function hasPending(){return Object.values(pending).some(text=>text.trim());}
function updateProgress(){
  if(!draft)return;
  let complete=0;const table=$('progress-table'),head=node('tr');head.append(node('th','学年'));M.ids.forEach(id=>head.append(node('th',M.names[id])));table.replaceChildren(head);
  for(const g of M.grades){const row=node('tr');row.append(node('th',g+'年'));for(const id of M.ids){const ok=!M.panelErrors(draft,g,id).length;if(ok)complete++;const cell=node('td'),b=node('button',ok?'入力済み':'未完了',ok?'complete':'');b.setAttribute('aria-label',g+'年 '+M.names[id]+' '+(ok?'入力済み':'未完了'));b.setAttribute('aria-pressed',String(g===grade&&id===subject));b.disabled=busy;b.onclick=()=>{grade=g;subject=id;renderPanel();};cell.append(b);row.append(cell);}table.append(row);}
  $('progress').textContent=complete+' / 15 教科 入力済み';
  const current=M.metadata(active),past=draft.year*5+draft.round<=current.year*5+current.round;
  $('publish').disabled=busy||finished||past||M.errors(draft).length>0||hasPending();
  const targetWarning='公開中の回より後の年度・回を指定してください。';
  if(!busy&&!finished){if(past)message('publish-status',targetWarning,true);else if($('publish-status').textContent===targetWarning)message('publish-status','');}
}
function renderRows(){
  const target=$('units');target.replaceChildren();
  for(const [list,shared] of [[common(),true],[units(),false]])list.forEach((u,index)=>{
    const row=node('tr');
    for(const [column,maxLength] of [[0,2],[1,500],[4,300]]){
      const cell=node('td'),input=node(column===0?'input':'textarea');if(column!==0)input.rows=2;input.value=u[column];input.maxLength=maxLength;
      input.setAttribute('aria-label',(shared?'共通 ':u[0]+' ')+({0:'記号',1:'単元名',4:'教材・ページ'}[column]));
      if(column===0&&shared)input.readOnly=true;
      input.oninput=()=>{u[column]=column===0?input.value.normalize('NFKC').toUpperCase().trim():input.value;mark();};cell.append(input);row.append(cell);
      if(column===0&&!shared)input.onchange=()=>{if(u[0]==='共通'){list.splice(index,1);common().push(u);mark();renderRows();}};
    }
    const cell=node('td'),remove=node('button','削除','danger');remove.setAttribute('aria-label',(shared?'共通':u[0])+'の行を削除');remove.onclick=()=>{list.splice(index,1);mark();renderRows();};cell.append(remove);row.append(cell);target.append(row);
  });
}
function renderPanel(){
  document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.grade===grade)));
  document.querySelectorAll('[data-subject]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.subject===subject)));
  $('panel-title').textContent=grade+'年生 '+M.names[subject];$('selection-count').value=draft.selectionCounts[grade]?.[subject]??2;
  $('paste').value=pending[panelKey()]||'';message('panel-status','');renderRows();updateProgress();
}
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{grade=b.dataset.grade;renderPanel();});
$('subjects').replaceChildren(...M.ids.map(id=>{const b=node('button',M.names[id]);b.dataset.subject=id;b.onclick=()=>{subject=id;renderPanel();};return b;}));
$('year').oninput=()=>{draft.year=Number($('year').value);mark();};$('round').onchange=()=>{draft.round=Number($('round').value);mark();};
$('selection-count').onchange=()=>{draft.selectionCounts[grade]??={};draft.selectionCounts[grade][subject]=Number($('selection-count').value);mark();};
$('paste').oninput=()=>{pending[panelKey()]=$('paste').value;updateProgress();message('panel-status','貼り付けた内容は「この教科に取り込む」で反映してください。');};
$('import').onclick=async()=>{
  try{
    const parsed=M.parse($('paste').value);
    if((units().length||common().length)&&!await confirmChange(grade+'年 '+M.names[subject]+'の入力内容を、貼り付けた内容に置き換えますか？','置き換える'))return;
    draft.subjects[subject].units[grade]=parsed.units;draft.common[grade]??={};draft.common[grade][subject]=parsed.common;
    pending[panelKey()]='';$('paste').value='';mark();renderRows();message('panel-status',parsed.units.length+'単元と共通'+parsed.common.length+'単元を取り込みました。');
  }catch(e){message('panel-status',e.message,true);}
};
$('add-unit').onclick=()=>{const code='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(c=>!units().some(u=>u[0]===c));if(!code){message('panel-status','選択単元は26件までです。',true);return;}units().push([code,'','','','']);mark();renderRows();};
$('add-common').onclick=()=>{if(common().length>=10){message('panel-status','共通単元は10件までです。',true);return;}common().push(['共通','','','','']);mark();renderRows();};
async function saveDraft(){
  if(hasPending())throw Error('貼り付けた内容を取り込んでから保存してください。');
  const r=await api('exam-save',{activeId:active.id,activeRevision,revision,draft});revision=r.revision;changed=false;
  message('save-status','✓ 下書き保存完了（'+new Date().toLocaleTimeString('ja-JP')+'）');
}
$('save').onclick=async()=>{if(busy)return;setBusy(true);message('save-status','保存中…');try{await saveDraft();}catch(e){message('save-status',e.message,true);}finally{setBusy(false);}};
$('publish').onclick=async()=>{
  const errors=M.errors(draft);if(busy||finished||errors.length||hasPending())return;
  if(!await confirmChange(M.title(draft)+'に全校舎を切り替えます。前回分は表示されなくなり、各校舎の選択単元は未決定になります。','全校舎を切り替える'))return;
  setBusy(true);message('publish-status','切り替え中…');
  try{
    if(changed||revision===0)await saveDraft();
    const result=await api('exam-publish',{activeId:active.id,activeRevision,revision});active=result.active;activeRevision=result.activeRevision;finished=true;changed=false;
    try{localStorage.setItem('test-range-current-id',active.id);}catch{}
    $('active-title').textContent='公開中：'+active.title;message('publish-status','✓ '+active.title+'へ切り替えました。');
    const link=node('a','新しい範囲を確認する','button');link.href='ranges.html?campus=chikusa-honbu';$('publish-status').append(node('br'),link);
    $('save').disabled=true;$('publish').disabled=true;
  }catch(e){message('publish-status',e.message+'\n通信が途切れた場合は、再読み込みして公開中の回を確認してください。',true);}
  finally{if(!finished)setBusy(false);}
};
$('login-form').onsubmit=async e=>{
  e.preventDefault();$('login-button').disabled=true;message('login-status','読み込み中…');
  try{
    await api('login',{pin:$('pin').value});$('pin').value='';
    const result=await api('exam-draft');active=result.active;activeRevision=result.activeRevision;draft=result.draft;revision=result.revision;
    $('active-title').textContent='公開中：'+active.title;$('year').value=draft.year;$('round').value=draft.round;
    $('login').hidden=true;$('editor').hidden=false;renderPanel();message('save-status',revision?'保存済みの下書きを開きました。':'次の回の範囲を入力してください。');
  }catch(e){message('login-status',e.message,true);}finally{$('pin').value='';$('login-button').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(changed||hasPending()){e.preventDefault();e.returnValue='';}});
api('catalog').then(r=>{$('active-title').textContent='公開中：'+r.exam.title;}).catch(()=>{$('active-title').textContent='公開中の範囲を取得できませんでした。';});
