(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RangeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SUBJECTS = {english:'英語',math:'数学',japanese:'国語',science:'理科',social:'社会'};
  function todayJst(now) {
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now || new Date());
  }
  function yearOf(today) { return Number(today.slice(0,4)) - (Number(today.slice(5,7)) < 4 ? 1 : 0); }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value+'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
  }
  function validate(test, publish) {
    const errors=[];
    if (!test || typeof test !== 'object') return ['資料の形式が不正です。'];
    if (typeof test.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(test.id)) errors.push('資料IDが不正です。');
    if (typeof test.school !== 'string' || !test.school.trim() || test.school.length>80) errors.push('学校名を入力してください（80文字以内）。');
    if (![1,2,3].includes(test.grade)) errors.push('学年を選択してください。');
    if (!Number.isInteger(test.year) || test.year<2000 || test.year>2100) errors.push('年度を確認してください。');
    if (typeof test.testName !== 'string' || !test.testName.trim() || test.testName.length>100) errors.push('テスト名を入力してください（100文字以内）。');
    if (!['draft','published'].includes(test.status)) errors.push('登録状態が不正です。');
    if (!Array.isArray(test.issues) || test.issues.length>30 || test.issues.some(s=>typeof s!=='string'||s.length>1000)) errors.push('要確認事項の形式が不正です。');
    const subjects=test.subjects;
    if (!subjects || typeof subjects!=='object' || Array.isArray(subjects) || !Object.keys(subjects).length) errors.push('教科を1つ以上入力してください。');
    else Object.entries(subjects).forEach(([code,s])=>{
      if (!Object.hasOwn(SUBJECTS,code)) {errors.push('対象外の教科があります。');return;}
      if (!s || typeof s!=='object') {errors.push(SUBJECTS[code]+'の内容を確認してください。');return;}
      if (typeof s.range!=='string'||s.range.length>12000||typeof s.points!=='string'||s.points.length>6000) errors.push(SUBJECTS[code]+'の範囲・ポイントを確認してください。');
      if (s.date && !validDate(s.date)) errors.push(SUBJECTS[code]+'の試験日が不正です。');
      if (validDate(s.date) && yearOf(s.date)!==test.year) errors.push(SUBJECTS[code]+'の試験日と年度が一致しません。');
      if (publish) {
        if (!validDate(s.date)) errors.push(SUBJECTS[code]+'の試験日を入力してください。');
        if (!(s.range||'').trim() && s.noRange!==true) errors.push(SUBJECTS[code]+'の範囲を入力するか「原本に記載なし」を確認してください。');
        if (/要確認|要原本確認|読み切れ/.test(s.range||'')) errors.push(SUBJECTS[code]+'の範囲に要確認の記載が残っています。');
      }
    });
    if (publish && test.reviewed!==true) errors.push('原本との照合を確認してください。');
    if (publish && Array.isArray(test.issues) && test.issues.length) errors.push('要確認事項をすべて解決してください。');
    return errors;
  }
  function sortCards(a,b) { return (a.subject.date||'9999').localeCompare(b.subject.date||'9999') || (a.test.kana||a.test.school).localeCompare(b.test.kana||b.test.school,'ja') || a.test.id.localeCompare(b.test.id); }
  function select(tests, opts) {
    const {grade,subject,school='',mode='upcoming',today=todayJst()}=opts;
    if (![1,2,3].includes(grade) || !Object.hasOwn(SUBJECTS,subject)) return [];
    const rows=tests.filter(t=>t.year===yearOf(today)&&t.grade===grade&&(!school||t.school===school)&&t.subjects[subject])
      .map(t=>({test:t,subject:t.subjects[subject]}));
    if(mode==='draft') return rows.filter(r=>r.test.status==='draft').sort(sortCards);
    const published=rows.filter(r=>r.test.status==='published'&&validDate(r.subject.date));
    if(mode==='upcoming') return published.filter(r=>r.subject.date>=today).sort(sortCards);
    const latest=new Map();
    published.filter(r=>r.subject.date<today).forEach(r=>{const old=latest.get(r.test.school);if(!old||sortCards(old,r)<0)latest.set(r.test.school,r);});
    return [...latest.values()].sort(sortCards);
  }
  function importData(value) {
    if(!value||value.schemaVersion!==1||!Array.isArray(value.tests)||value.tests.length>500) throw Error('範囲データ（schemaVersion: 1）のJSONファイルを選んでください。');
    const ids=new Set();
    value.tests.forEach(t=>{const errors=validate(t,false);if(errors.length)throw Error(t.school+'：'+errors.join(' '));if(ids.has(t.id))throw Error('同じ資料IDが重複しています。');ids.add(t.id);});
    return JSON.parse(JSON.stringify(value.tests));
  }
  return {SUBJECTS,todayJst,yearOf,validDate,validate,sortCards,select,importData};
});
