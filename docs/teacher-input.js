'use strict';
window.TeacherInput={create(options){
  const {root,selector,exam}=options,order=['english','math','science','social','japanese'];
  const workspaces=new Map();
  let school='',grade=1,layout='school',subject='english',busy=false;
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const copy=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const normalized=r=>r?.kind==='alternate'?{kind:'alternate',codes:[...r.codes].sort(),text:r.text.trim()}:{kind:'units',codes:[...(r?.codes||[])].sort()};
  const signature=r=>JSON.stringify(normalized(r));
  const draftFrom=r=>({kind:r?.kind==='alternate'?'alternate':'units',codes:[...(r?.codes||[])],text:r?.kind==='alternate'?r.text:''});
  const count=(id,g)=>exam.selectionCounts[g]?.[id]||2;
  const common=(id,g)=>exam.common[g]?.[id]||[];
  const pageLabel=u=>u[4]||[u[2],u[3]?'P'+u[3]:''].filter(Boolean).join('　');
  function raw(sid,g,id){const records=options.getData().records;return records[sid+':'+g+(id==='social'?'':':'+id)]||(id==='social'?records[sid+':'+g+':social']:null)||null;}
  function valid(id,r,g){return !!r&&Array.isArray(r.codes)&&new Set(r.codes).size===r.codes.length&&r.codes.every(c=>exam.subjects[id].units[g].some(u=>u[0]===c))&&(r.kind==='alternate'?r.codes.length<count(id,g)&&typeof r.text==='string'&&r.text.trim().length>0&&r.text.length<=500:r.codes.length===count(id,g));}
  function workspace(sid,g){
    const key=sid+':'+g;
    if(!workspaces.has(key))workspaces.set(key,{school:sid,grade:g,drafts:Object.fromEntries(order.map(id=>[id,draftFrom(raw(sid,g,id))])),base:Object.fromEntries(order.map(id=>[id,copy(raw(sid,g,id))])),messages:{},conflicts:new Set(),batchMessage:''});
    return workspaces.get(key);
  }
  const dirty=(w,id)=>signature(w.drafts[id])!==signature(w.base[id]);
  const dirtyCount=()=>[...workspaces.values()].reduce((n,w)=>n+order.filter(id=>dirty(w,id)).length,0);
  function syncData(){
    // Refresh only clean entries. Pending entries keep the baseline they were edited against.
    for(const w of workspaces.values())for(const id of order)if(!dirty(w,id)&&!w.conflicts.has(id)){
      const latest=raw(w.school,w.grade,id);
      if(signature(latest)!==signature(w.base[id]))delete w.messages[id];
      w.base[id]=copy(latest);w.drafts[id]=draftFrom(latest);
    }
  }
  function available(){return options.getData().schools.filter(s=>(Array.isArray(s.grades)?s.grades:[1,2,3]).includes(grade));}
  function rows(){return layout==='school'?(available().some(s=>s.id===school)?order.map(id=>({w:workspace(school,grade),id})):[]):available().map(s=>({w:workspace(s.id,grade),id:subject}));}
  function changed(w,id){delete w.messages[id];w.batchMessage='';options.onMessage('');}
  function resolve(w,id){
    const name=options.getData().schools.find(s=>s.id===w.school)?.name||'中学校';
    if(busy||!confirm(name+' '+w.grade+'年生 '+exam.subjects[id].name+'の入力を取り消し、最新の保存内容を読み込みますか？'))return;
    w.base[id]=copy(raw(w.school,w.grade,id));w.drafts[id]=draftFrom(w.base[id]);w.conflicts.delete(id);changed(w,id);render();
  }
  function toggleCode(w,id,code){
    if(busy)return;const d=w.drafts[id];changed(w,id);
    if(d.codes.includes(code))d.codes=d.codes.filter(c=>c!==code);
    else if(d.codes.length<(d.kind==='alternate'?count(id,w.grade)-1:count(id,w.grade)))d.codes.push(code);
    render();
  }
  function toggleAlternate(w,id,inputId){
    if(busy)return;changed(w,id);const d=w.drafts[id];d.kind=d.kind==='alternate'?'units':'alternate';render();
    if(d.kind==='alternate')document.getElementById(inputId)?.focus();
  }
  function updateStates(){
    const pending=dirtyCount(),summary=root.querySelector('#pending-inputs');
    if(summary){summary.hidden=!pending;summary.textContent='未保存の入力：'+pending+'件。学校・学年・教科を切り替えても入力内容を保持します。';}
    for(const {w,id} of rows()){
      const row=[...root.querySelectorAll('.teacher-row')].find(r=>r.dataset.school===w.school&&r.dataset.subject===id);if(!row)continue;
      const save=row.querySelector('.save-subject'),status=row.querySelector('.subject-state'),message=w.messages[id];
      save.disabled=!options.isReady()||busy||!valid(id,w.drafts[id],w.grade)||w.conflicts.has(id);
      status.className='subject-state '+(w.conflicts.has(id)||message?.error?'save-error':dirty(w,id)?'save-pending':valid(id,w.base[id],w.grade)?'save-success':'');
      status.textContent=w.conflicts.has(id)?'他の先生が更新しました。最新内容を確認してください。':message?.text||(dirty(w,id)?'未保存':valid(id,w.base[id],w.grade)?'✓ 保存済み':'未決定');
    }
    const saveAll=root.querySelector('#save'),state=root.querySelector('#save-state');
    if(layout==='school'&&school&&saveAll&&state){
      const w=workspace(school,grade),complete=order.filter(id=>valid(id,w.drafts[id],grade)).length,changed=order.some(id=>dirty(w,id));
      saveAll.disabled=!options.isReady()||busy||complete!==5||w.conflicts.size>0;
      state.className='state '+(changed?'save-pending':complete===5?'save-success':'');
      state.textContent=busy?'保存中…':w.batchMessage||(changed?'未保存の変更があります（'+complete+'／５教科 入力済み）':complete===5?'✓ 保存済み':complete+'／５教科 入力済み。教科ごとに保存できます。');
    }
  }
  function makeRow(w,id,index){
    const info=exam.subjects[id],d=w.drafts[id],bySubject=layout==='subject';
    const schoolName=options.getData().schools.find(s=>s.id===w.school)?.name||'中学校';
    const context=schoolName+' '+w.grade+'年生 '+info.name;
    const row=node('section','teacher-row'+(bySubject?' school-input-row':''));row.dataset.school=w.school;row.dataset.subject=id;
    row.setAttribute('role','group');row.setAttribute('aria-label',context+'の入力');
    row.append(node('h3','subject-name',bySubject?schoolName:info.name));
    const choices=node('div','symbol-options');choices.setAttribute('role','group');choices.setAttribute('aria-label',bySubject?context+'の範囲':info.name+'の範囲');
    common(id,w.grade).forEach(u=>choices.append(node('span','tag','共通：'+u[1])));
    info.units[w.grade].forEach(u=>{
      const selected=d.codes.includes(u[0]),b=node('button','symbol-button',u[0]);b.type='button';b.setAttribute('aria-pressed',String(selected));
      b.setAttribute('aria-label',(bySubject?context:info.name)+' '+u[0]+' '+u[1]);b.title=u[1]+(pageLabel(u)?'　'+pageLabel(u):'');
      b.disabled=busy||(!selected&&d.codes.length>=(d.kind==='alternate'?count(id,w.grade)-1:count(id,w.grade)));b.onclick=()=>toggleCode(w,id,u[0]);choices.append(b);
    });
    const inputId=bySubject?'alternate-row-'+index:'alternate-'+id;
    const alt=node('button','symbol-button alternate-button','別版');alt.type='button';alt.disabled=busy;alt.setAttribute('aria-pressed',String(d.kind==='alternate'));alt.setAttribute('aria-label',(bySubject?context:info.name)+' 別版');alt.onclick=()=>toggleAlternate(w,id,inputId);choices.append(alt);row.append(choices);
    if(d.kind==='alternate'){
      const field=node('div','alternate-field'),label=node('label','label',(bySubject?context:info.name)+'・別版の内容'),input=node('textarea');
      input.id=inputId;label.htmlFor=inputId;input.rows=2;input.maxLength=500;input.disabled=busy;input.placeholder='別版の範囲を入力（２単元とも別版の場合は、この枠に両方入力）';input.value=d.text;
      input.oninput=()=>{changed(w,id);d.text=input.value;updateStates();};field.append(label,input);
      if(d.codes.length>=count(id,w.grade))field.append(node('p','state','別版を使う場合は、選択中の記号を解除して合計の題数を合わせてください。'));row.append(field);
    }
    const actions=node('div','subject-save'),save=node('button','save-subject','保存'),status=node('p','subject-state');
    save.id=bySubject?'save-row-'+index:'save-'+id;save.type='button';save.setAttribute('aria-label',(bySubject?context:info.name)+'を保存');save.onclick=()=>saveSubjects(w,[id]);
    status.id=bySubject?'subject-state-row-'+index:'subject-state-'+id;status.setAttribute('role','status');status.setAttribute('aria-live','polite');actions.append(save,status);
    if(w.conflicts.has(id)){
      const b=node('button','resolve-conflict','最新内容を読み込む');b.type='button';b.disabled=busy;b.setAttribute('aria-label',(bySubject?context:info.name)+'の最新内容を読み込む');b.onclick=()=>resolve(w,id);actions.append(b);
    }
    row.append(actions);return row;
  }
  function render(){
    root.replaceChildren();selector.replaceChildren();
    for(const id of order){const b=node('button','school-button',exam.subjects[id].name);b.type='button';b.disabled=busy;b.setAttribute('aria-pressed',String(subject===id));b.onclick=()=>{if(busy)return;subject=id;options.onMessage('');render();};selector.append(b);}
    const top=node('div','teacher-input-top'),switcher=node('div','input-layout-switch');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','入力方法');
    for(const [id,label] of [['school','学校ごと'],['subject','教科ごと']]){const b=node('button','',label);b.type='button';b.disabled=busy;b.setAttribute('aria-pressed',String(layout===id));b.onclick=()=>{if(busy||layout===id)return;layout=id;options.onMessage('');options.onLayoutChange();};switcher.append(b);}
    top.append(switcher);
    const name=options.getData().schools.find(s=>s.id===school)?.name||'中学校未設定';
    const heading=node('h2','',layout==='school'?name+'　'+grade+'年生':grade+'年生　'+exam.subjects[subject].name+'　中学校別入力');heading.id='teacher-heading';top.append(heading);
    top.append(node('p','hint',layout==='school'?'各教科の指定数を選び、教科ごとに保存できます。５教科まとめて保存もできます。':'各行の中学校名を確認して、指定数を選び保存してください。保存の対象は、その行だけです。'));
    const pending=node('p','pending-inputs');pending.id='pending-inputs';pending.setAttribute('role','status');top.append(pending);root.append(top);
    const list=node('div');list.id='teacher-rows';root.append(list);const visible=rows();
    if(!visible.length)list.append(node('p','notice','この学年の中学校は未設定です。校舎管理で在籍する学年を設定してください。'));
    visible.forEach(({w,id},i)=>list.append(makeRow(w,id,i)));
    if(layout==='school'&&visible.length){
      const footer=node('div','batch-save'),state=node('p','state'),save=node('button','primary','５教科まとめて保存');state.id='save-state';state.setAttribute('role','status');state.setAttribute('aria-live','polite');save.id='save';save.type='button';save.onclick=()=>saveSubjects(workspace(school,grade),order,true);footer.append(state,save);root.append(footer);
    }
    root.classList.toggle('subject-input-layout',layout==='subject');updateStates();
  }
  async function saveSubjects(w,ids,all=false){
    if(busy||!options.isReady()||!options.isEditing()||ids.some(id=>!valid(id,w.drafts[id],w.grade)||w.conflicts.has(id)))return;
    const changes=ids.filter(id=>!all||dirty(w,id)).map(id=>({subject:id,expected:copy(w.base[id]),record:normalized(w.drafts[id])}));
    busy=true;w.batchMessage='';for(const id of ids)w.messages[id]={text:'保存中…'};options.onMessage('');options.onBusy(true);render();
    try{
      if(!(await options.ensureEdit()))return;
      const response=await fetch('/api/save-ranges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campus:options.campus,exam:exam.id,school:w.school,grade:w.grade,changes})});
      const result=await response.json();
      if(!response.ok){
        if(response.status===403)options.onAuthError();
        if(result.code==='RANGE_CONFLICT'&&result.data){options.onData(result.data,result.revision);for(const id of result.subjects||[])w.conflicts.add(id);syncData();}
        throw Error(result.error||'保存できませんでした。');
      }
      if(!options.isReady())return;
      if(!result.data)throw Error('保存結果を確認できませんでした。再読み込みして確認してください。');
      options.onData(result.data,result.revision);
      for(const id of ids){w.base[id]=copy(raw(w.school,w.grade,id));w.drafts[id]=draftFrom(w.base[id]);w.conflicts.delete(id);}
      syncData();const time=new Date().toLocaleTimeString('ja-JP');for(const id of ids)w.messages[id]={text:'✓ 保存完了（'+time+'）'};
      if(all)w.batchMessage='✓ ５教科の保存完了（'+time+'）';
    }catch(error){
      for(const id of ids)w.messages[id]={text:w.conflicts.has(id)?'他の先生が更新しました。最新内容を確認してください。':'保存できませんでした。',error:true};
      options.onMessage(error.message);if(all)w.batchMessage='保存できませんでした。入力内容と画面の案内を確認してください。';
    }finally{
      for(const id of ids)if(w.messages[id]?.text==='保存中…')delete w.messages[id];
      busy=false;options.onBusy(false);if(options.isReady())render();
    }
  }
  return {setContext(context){school=context.school;grade=context.grade;render();},syncData,isDirty:()=>dirtyCount()>0,isBusy:()=>busy,getLayout:()=>layout,getSubject:()=>subject};
}};