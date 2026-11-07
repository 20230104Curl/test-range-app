/**
 * 千種本部校 テスト範囲比較 / Google側共有保存
 * GitHubには学校の原本・読み取りデータ・認証情報を含めません。
 * 初回にsetupRangeAppをエディターから実行し、ウェブアプリとして公開します。
 */
var RANGE_APP = {
  folderName: '定期テスト範囲比較_千種本部校',
  seedName: '中3_2026年11月_読み取り結果.json',
  sheetName: '定期テスト範囲比較_共有データ_20261107',
  maxFileBytes: 10 * 1024 * 1024,
  testHeaders: ['id','version','updatedAt','requestId','requestHash','testJSON'],
  fileHeaders: ['id','name','mime','size','requestId','contentHash'],
  auditHeaders: ['updatedAt','testId','version','beforeJSON','afterJSON']
};

function setupRangeApp() {
  var lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var props=PropertiesService.getScriptProperties(), folders=DriveApp.getFoldersByName(RANGE_APP.folderName);
    if(!folders.hasNext()) throw Error('Googleドライブに「'+RANGE_APP.folderName+'」が見つかりません。資料を保存したアカウントで実行してください。');
    var folder=folders.next();
    if(folders.hasNext())throw Error('同名の保存フォルダーが複数あります。先に対象を確認してください。');
    var ss, savedId=props.getProperty('RANGE_SHEET_ID');
    if(savedId) ss=SpreadsheetApp.openById(savedId);
    else {
      var existing=folder.getFilesByName(RANGE_APP.sheetName);
      if(existing.hasNext()) {var file=existing.next();if(existing.hasNext())throw Error('同名の共有データが複数あります。対象を確認してください。');ss=SpreadsheetApp.openById(file.getId());}
      else {ss=SpreadsheetApp.create(RANGE_APP.sheetName);DriveApp.getFileById(ss.getId()).moveTo(folder);}
    }
    ss.setSpreadsheetTimeZone('Asia/Tokyo');
    if(!ss.getSheetByName('範囲データ')&&ss.getSheets().length===1&&ss.getSheets()[0].getLastRow()===0)ss.getSheets()[0].setName('範囲データ');
    var tests=rangeEnsureSheet_(ss,'範囲データ',RANGE_APP.testHeaders);
    rangeEnsureSheet_(ss,'原本一覧',RANGE_APP.fileHeaders);
    rangeEnsureSheet_(ss,'変更記録',RANGE_APP.auditHeaders);
    if(tests.getLastRow()===1){
      var seeds=folder.getFilesByName(RANGE_APP.seedName);
      if(!seeds.hasNext())throw Error('読み取り結果JSONが見つかりません。共有データは空欄のままです。');
      var seedFile=seeds.next();if(seeds.hasNext())throw Error('読み取り結果JSONが複数あります。対象を確認してください。');
      var seed=JSON.parse(seedFile.getBlob().getDataAsString('UTF-8'));
      if(seed.schemaVersion!==1||!Array.isArray(seed.tests))throw Error('読み取り結果JSONの形式が不正です。');
      var now=new Date().toISOString(), rows=[], ids={};
      seed.tests.forEach(function(t){rangeValidate_(t,false);if(ids[t.id])throw Error('読み取り結果のIDが重複しています。');ids[t.id]=true;t.status='draft';t.reviewed=false;t.version=1;t.updatedAt=now;rows.push([t.id,1,now,'seed','',JSON.stringify(t)]);});
      if(rows.length)tests.getRange(2,1,rows.length,RANGE_APP.testHeaders.length).setValues(rows);
    }
    // 保存先IDは設定が成功した最後に確定します。既存データは上書きしません。
    props.setProperties({RANGE_SHEET_ID:ss.getId(),RANGE_FOLDER_ID:folder.getId()});
    console.log('初回設定完了：'+ss.getUrl());
  } finally {lock.releaseLock();}
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>テスト範囲比較・共有保存</title><body style="font:16px sans-serif;padding:35px;line-height:2"><h1>テスト範囲比較・共有保存</h1><p>このURLを、GitHub版アプリの「接続設定」に貼り付けてください。</p><p>初回設定はApps Scriptのエディターで setupRangeApp を実行します。</p></body></html>');
}

function doPost(e) {
  var lock;
  try {
    if(!e||!e.postData||typeof e.postData.contents!=='string'||e.postData.contents.length>15000000)rangeFail_('INVALID','入力の形式またはサイズが不正です。');
    var b=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties();
    if(!props.getProperty('RANGE_SHEET_ID')||!props.getProperty('RANGE_FOLDER_ID'))rangeFail_('SETUP_REQUIRED','初回設定が終わっていません。エディターからsetupRangeAppを実行してください。');
    var ss=SpreadsheetApp.openById(props.getProperty('RANGE_SHEET_ID'));
    if(b.action==='list')return rangeJson_({ok:true,today:rangeToday_(),tests:rangeReadTests_(ss).map(function(r){return r.test;})});
    if(b.action==='original')return rangeJson_(rangeOriginal_(ss,b,props));
    if(!['save','upload'].includes(b.action))rangeFail_('INVALID','対応していない処理です。');
    lock=LockService.getScriptLock();
    if(!lock.tryLock(25000))rangeFail_('BUSY','他の保存処理が実行中です。少し待ってから再試行してください。');
    if(b.action==='save')return rangeJson_(rangeSave_(ss,b,props));
    return rangeJson_(rangeUpload_(ss,b,props));
  }catch(err){
    return rangeJson_({ok:false,code:err.rangeCode||'SERVER_ERROR',error:err.rangeCode?err.message:'Google側で処理を完了できませんでした。下書きを閉じずに再試行してください。'});
  }finally {if(lock&&lock.hasLock())lock.releaseLock();}
}

function rangeSave_(ss,b,props) {
  rangeRequestId_(b.requestId);
  var t=b.test;rangeValidate_(t,!!t&&t.status==='published');
  if(!Number.isInteger(b.expectedVersion)||b.expectedVersion<0)rangeFail_('INVALID','版番号が不正です。');
  var rows=rangeReadTests_(ss), old=rows.find(function(r){return r.test.id===t.id;}),hash=rangeHash_(JSON.stringify({test:t,expectedVersion:b.expectedVersion}));
  if(old&&old.requestId===b.requestId){if(old.requestHash!==hash)rangeFail_('UNCERTAIN_WRITE','前回と同じ送信IDで入力内容が変更されています。入力内容をJSONに退避してから、共有データを更新して確認してください。');return {ok:true,test:old.test,replayed:true};}
  if((old?old.test.version:0)!==b.expectedVersion)rangeFail_('CONFLICT','他の画面で更新されています。入力内容を保管して、最新の共有データと照合してください。');
  var key=function(x){return x.school.replace(/[\s　]/g,'')+'|'+x.grade+'|'+x.year+'|'+x.testName.replace(/[\s　]/g,'');};
  var duplicate=rows.find(function(r){return r.test.id!==t.id&&key(r.test)===key(t);});
  if(duplicate)rangeFail_('DUPLICATE','同じ学校・学年・年度・テスト名が登録されています。既存の資料から修正してください。');
  if(t.source&&t.source.fileId&&!rangeAllowedFile_(ss,t.source.fileId))rangeFail_('INVALID','原本がこのアプリに登録されていません。先にPDF・写真を登録してください。');
  var result=rangeCleanTest_(t);result.version=(old?old.test.version:0)+1;result.updatedAt=new Date().toISOString();
  var json=JSON.stringify(result);if(json.length>45000)rangeFail_('INVALID','1件の範囲が長すぎます。45,000文字以内にしてください。');
  // 本体・版・送信IDを同じ行に書くことで、応答消失時の再送も二重登録しません。
  var sheet=ss.getSheetByName('範囲データ'),rowNumber=old?old.rowNumber:sheet.getLastRow()+1;
  sheet.getRange(rowNumber,1,1,RANGE_APP.testHeaders.length).setValues([[result.id,result.version,result.updatedAt,b.requestId,hash,json]]);
  try{ss.getSheetByName('変更記録').appendRow([result.updatedAt,result.id,result.version,old?JSON.stringify(old.test):'',json]);}catch(auditError){console.warn('変更記録の追記が未完了です。保存本体は完了しています。');}
  return {ok:true,test:result};
}

function rangeUpload_(ss,b,props) {
  rangeRequestId_(b.requestId);
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!['application/pdf','image/jpeg','image/png'].includes(b.mime)||typeof b.base64!=='string'||!b.base64.length||b.base64.length>14000000)rangeFail_('INVALID','10MBまでのPDF・JPEG・PNGを選んでください。');
  var bytes;try{bytes=Utilities.base64Decode(b.base64);}catch(_){rangeFail_('INVALID','ファイルを読み込めません。');}
  if(!bytes.length||bytes.length>RANGE_APP.maxFileBytes)rangeFail_('INVALID','ファイルは10MBまでです。');
  var unsigned=function(i){return (bytes[i]+256)%256;};
  var valid=b.mime==='application/pdf'?String.fromCharCode.apply(null,bytes.slice(0,5))==='%PDF-':b.mime==='image/jpeg'?unsigned(0)===255&&unsigned(1)===216:unsigned(0)===137&&unsigned(1)===80&&unsigned(2)===78&&unsigned(3)===71;
  if(!valid)rangeFail_('INVALID','ファイルの内容と形式が一致しません。');
  var sheet=ss.getSheetByName('原本一覧'),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues():[],contentHash=rangeHash_(b.base64);
  var old=rows.find(function(r){return r[4]===b.requestId;});
  if(old){if(old[1]!==b.name||old[2]!==b.mime||old[3]!==bytes.length||old[5]!==contentHash)rangeFail_('INVALID','同じ送信IDのファイル内容が変更されています。選び直してください。');return {ok:true,file:{id:old[0],name:old[1],mime:old[2]}};}
  var folder=DriveApp.getFolderById(props.getProperty('RANGE_FOLDER_ID')),storedName=b.requestId+'_'+b.name.replace(/[\\/\u0000-\u001f]/g,'_'),prior=folder.getFilesByName(storedName),file;
  if(prior.hasNext())file=prior.next();else file=folder.createFile(Utilities.newBlob(bytes,b.mime,storedName));
  sheet.appendRow([file.getId(),b.name,b.mime,bytes.length,b.requestId,contentHash]);
  return {ok:true,file:{id:file.getId(),name:b.name,mime:b.mime}};
}

function rangeOriginal_(ss,b,props) {
  if(typeof b.fileId!=='string'||!rangeAllowedFile_(ss,b.fileId))rangeFail_('NOT_FOUND','登録済みの原本が見つかりません。');
  var file=DriveApp.getFileById(b.fileId),parents=file.getParents(),inFolder=false;
  while(parents.hasNext())if(parents.next().getId()===props.getProperty('RANGE_FOLDER_ID'))inFolder=true;
  if(!inFolder)rangeFail_('NOT_FOUND','原本が保存フォルダーから移動されています。');
  var mime=file.getMimeType();
  if(!['application/pdf','image/png','image/jpeg'].includes(mime)||file.getSize()>RANGE_APP.maxFileBytes)rangeFail_('INVALID','この形式またはサイズは画面内で表示できません。Driveで開いてください。');
  return {ok:true,mime:mime,name:file.getName(),base64:Utilities.base64Encode(file.getBlob().getBytes())};
}

function rangeAllowedFile_(ss,id) {
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))return false;
  if(rangeReadTests_(ss).some(function(r){return r.test.source&&r.test.source.fileId===id;}))return true;
  var sheet=ss.getSheetByName('原本一覧');
  return sheet.getLastRow()>1&&sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues().some(function(r){return r[0]===id;});
}

function rangeReadTests_(ss) {
  var sheet=ss.getSheetByName('範囲データ');if(sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().map(function(r,i){return r[0]?{rowNumber:i+2,requestId:r[3],requestHash:r[4],test:JSON.parse(r[5])}:null;}).filter(function(r){return r!==null;});
}
function rangeEnsureSheet_(ss,name,headers) {
  var sheet=ss.getSheetByName(name)||ss.insertSheet(name);
  if(!sheet.getLastRow()){sheet.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#08786f').setFontColor('#ffffff').setFontWeight('bold');sheet.setFrozenRows(1);sheet.setColumnWidths(1,headers.length,170);}
  else if(JSON.stringify(sheet.getRange(1,1,1,headers.length).getValues()[0])!==JSON.stringify(headers))throw Error(name+'の列構成が想定と違います。データを保護するため処理を停止しました。');
  return sheet;
}
function rangeToday_(){return Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');}
function rangeRequestId_(s){if(typeof s!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(s))rangeFail_('INVALID','送信IDが不正です。');}
function rangeHash_(s){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8));}
function rangeFail_(code,message){var err=Error(message);err.rangeCode=code;throw err;}
function rangeJson_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function rangeCleanTest_(t){return {id:t.id,school:t.school.trim(),kana:typeof t.kana==='string'?t.kana.trim():t.school.trim(),grade:t.grade,year:t.year,testName:t.testName.trim(),status:t.status,version:t.version||0,reviewed:t.reviewed===true,issues:t.issues.slice(),subjects:JSON.parse(JSON.stringify(t.subjects)),source:t.source?{fileId:t.source.fileId,name:t.source.name||'',page:t.source.page||1}:null};}

// 以下は、画面側と同じ入力検証です。ブラウザーのチェックを回避しても登録条件は変わりません。
function rangeValidate_(test,publish){
  var errors=rangeValidationErrors_(test,publish);if(errors.length)rangeFail_('VALIDATION',errors.join('\n'));
}
function rangeValidationErrors_(test,publish){
  var subjects={english:'英語',math:'数学',japanese:'国語',science:'理科',social:'社会'},errors=[];
  function dateOk(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;var d=new Date(value+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
  function yearOf(value){return Number(value.slice(0,4))-(Number(value.slice(5,7))<4?1:0);}
  if(!test||typeof test!=='object')return ['資料の形式が不正です。'];
  if(typeof test.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(test.id))errors.push('資料IDが不正です。');
  if(typeof test.school!=='string'||!test.school.trim()||test.school.length>80)errors.push('学校名を確認してください。');
  if(![1,2,3].includes(test.grade))errors.push('学年を確認してください。');
  if(!Number.isInteger(test.year)||test.year<2000||test.year>2100)errors.push('年度を確認してください。');
  if(typeof test.testName!=='string'||!test.testName.trim()||test.testName.length>100)errors.push('テスト名を確認してください。');
  if(!['draft','published'].includes(test.status))errors.push('登録状態が不正です。');
  if(!Array.isArray(test.issues)||test.issues.length>30||test.issues.some(function(s){return typeof s!=='string'||s.length>1000;}))errors.push('要確認事項の形式が不正です。');
  if(test.source&&(typeof test.source.fileId!=='string'||!/^[A-Za-z0-9_-]{10,200}$/.test(test.source.fileId)||!Number.isInteger(test.source.page)||test.source.page<1||test.source.page>100))errors.push('原本情報が不正です。');
  if(!test.subjects||typeof test.subjects!=='object'||Array.isArray(test.subjects)||!Object.keys(test.subjects).length)errors.push('教科を1つ以上入力してください。');
  else Object.keys(test.subjects).forEach(function(code){
    if(!Object.prototype.hasOwnProperty.call(subjects,code)){errors.push('対象外の教科があります。');return;}
    var s=test.subjects[code];if(!s||typeof s!=='object'){errors.push(subjects[code]+'の内容を確認してください。');return;}
    if(typeof s.range!=='string'||s.range.length>12000||typeof s.points!=='string'||s.points.length>6000)errors.push(subjects[code]+'の範囲・ポイントを確認してください。');
    if(s.date&&!dateOk(s.date))errors.push(subjects[code]+'の試験日が不正です。');
    if(dateOk(s.date)&&yearOf(s.date)!==test.year)errors.push(subjects[code]+'の試験日と年度が一致しません。');
    if(publish){if(!dateOk(s.date))errors.push(subjects[code]+'の試験日を入力してください。');if(!(s.range||'').trim()&&s.noRange!==true)errors.push(subjects[code]+'の範囲を確認してください。');if(/要確認|要原本確認|読み切れ/.test(s.range||''))errors.push(subjects[code]+'の範囲に要確認の記載が残っています。');}
  });
  if(publish&&test.reviewed!==true)errors.push('原本との照合を確認してください。');
  if(publish&&Array.isArray(test.issues)&&test.issues.length)errors.push('要確認事項をすべて解決してください。');
  return errors;
}
