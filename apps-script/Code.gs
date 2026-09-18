// Private Drive folder ID and a long random AUTH_SECRET must be set in Script Properties.
function props_(){return PropertiesService.getScriptProperties();}
function fail_(status,message){throw {status:status,message:message};}
function hash_(text){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text,props_().getProperty('AUTH_SECRET')));}
function read_(name){const files=DriveApp.getFolderById(props_().getProperty('DATA_FOLDER_ID')).getFilesByName(name);return files.hasNext()?JSON.parse(files.next().getBlob().getDataAsString('UTF-8')):null;}
function write_(name,data){const folder=DriveApp.getFolderById(props_().getProperty('DATA_FOLDER_ID'));const files=folder.getFilesByName(name),text=JSON.stringify(data);if(files.hasNext())files.next().setContent(text);else folder.createFile(name,text,MimeType.PLAIN_TEXT);}
function auth_(body,credential){
  try{const parts=body.token.split('.');if(parts.length!==2||hash_(parts[0])!==parts[1])return false;const info=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());return info.campus===body.campus&&info.expires>Date.now()&&info.version===(credential.version||0);}catch(e){return false;}
}
function token_(campus,credential){const payload=Utilities.base64EncodeWebSafe(JSON.stringify({campus:campus,expires:Date.now()+8*3600000,version:credential.version||0,nonce:Utilities.getUuid()}));return payload+'.'+hash_(payload);}
function validPin_(pin){return typeof pin==='string'&&/^[0-9]{4}$/.test(pin);}
function validate_(data){
  if(!data||!Array.isArray(data.schools)||!data.schools.length||data.schools.length>500||!data.records||typeof data.records!=='object'||Array.isArray(data.records))fail_(400,'保存内容が不正です');
  const ids=new Set();
  data.schools.forEach(s=>{if(typeof s.id!=='string'||!s.id||s.id.length>100||s.id.includes(':')||ids.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>80||!Array.isArray(s.grades)||s.grades.some(g=>![1,2,3].includes(g)))fail_(400,'中学校の設定が不正です');ids.add(s.id);});
  Object.entries(data.records).forEach(([key,r])=>{const p=key.split(':'),subject=p[2]||'social';if(![2,3].includes(p.length)||!ids.has(p[0])||!['1','2','3'].includes(p[1])||!Object.hasOwn(EXAM.subjects,subject))fail_(400,'範囲が不正です');const count=(EXAM.selectionCounts[p[1]]||{})[subject]||2,allowed=EXAM.subjects[subject].units[p[1]].map(u=>u[0]);if(!r||!Array.isArray(r.codes)||new Set(r.codes).size!==r.codes.length||r.codes.some(c=>!allowed.includes(c)))fail_(400,'単元が不正です');if(r.kind==='alternate'){if(r.codes.length>=count||typeof r.text!=='string'||!r.text.trim()||r.text.length>500)fail_(400,'別版を確認してください');}else if(r.codes.length!==count)fail_(400,'選択数を確認してください');});
}
function doPost(e){
  let lock;
  try{
    if(!props_().getProperty('DATA_FOLDER_ID')||!props_().getProperty('AUTH_SECRET'))fail_(503,'保存先が未設定です');
    if(!e.postData||e.postData.contents.length>2000000)fail_(400,'入力が不正です');
    const b=JSON.parse(e.postData.contents);if(!Object.hasOwn(CAMPUSES,b.campus))fail_(400,'校舎が不正です');
    lock=LockService.getScriptLock();if(!lock.tryLock(20000))fail_(503,'処理中です。少し待って再度お試しください');
    const name=b.campus+'-'+EXAM.id+'.json',credentialName=b.campus+'-password.json';
    const credential=read_(credentialName)||{hash:hash_(b.campus+':4982'),version:0};
    let result;
    if(b.action==='login'){
      const key='attempts:'+b.campus;let attempts=JSON.parse(props_().getProperty(key)||'{"count":0,"until":0}');if(attempts.until<Date.now())attempts={count:0,until:Date.now()+300000};
      if(attempts.count>=10)fail_(429,'しばらく待ってから再入力してください');
      if(!validPin_(b.pin)||hash_(b.campus+':'+b.pin)!==credential.hash){attempts.count++;props_().setProperty(key,JSON.stringify(attempts));fail_(401,'パスワードが違います');}
      props_().deleteProperty(key);result={token:token_(b.campus,credential)};
    }else if(b.action==='password'){
      if(!auth_(b,credential))fail_(403,'編集パスワードを入力してください');if(!validPin_(b.pin))fail_(400,'半角数字４桁で入力してください');
      const next={hash:hash_(b.campus+':'+b.pin),version:(credential.version||0)+1};write_(credentialName,next);result={token:token_(b.campus,next)};
    }else if(b.action==='state'||b.action==='save'){
      if(b.exam!==EXAM.id)fail_(409,'範囲表が更新されています。再読み込みしてください');
      const old=read_(name)||{revision:0,data:null};
      if(b.action==='state')result=Object.assign({},old,{canEdit:auth_(b,credential)});
      else{if(!auth_(b,credential))fail_(403,'編集パスワードを入力してください');validate_(b.data);if(b.revision!==old.revision)fail_(409,'別の画面で更新されました。再読み込みしてください');write_(name,{revision:old.revision+1,data:b.data});result={revision:old.revision+1};}
    }else fail_(404,'処理が見つかりません');
    return json_(Object.assign({status:200},result));
  }catch(err){return json_({status:err.status||500,error:err.status?err.message:'処理に失敗しました。時間をおいて再度お試しください。'});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
