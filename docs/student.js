'use strict';
(()=>{
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),campus=params.get('campus');
const order=['english','math','science','social','japanese'];
let exam,db={schools:[],records:{}},grade=1,school='',view='selected',busy=false,expired=false,loaded=false;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function unit(u,common=false){const n=node('div',undefined,'unit'+(common?' common':''));n.append(node('strong',u[0]+'　'+u[1]));const pages=u[4]||[u[2],u[3]?'P'+u[3]:''].filter(Boolean).join('　');if(pages)n.append(node('span',pages,'pages'));return n;}
function record(id){const r=db.records[school+':'+grade+':'+id]||(id==='social'?db.records[school+':'+grade]:null),count=exam.selectionCounts?.[grade]?.[id]||2;if(!r||!Array.isArray(r.codes)||new Set(r.codes).size!==r.codes.length||!r.codes.every(c=>exam.subjects[id].units[grade].some(u=>u[0]===c)))return null;return (r.kind==='alternate'?r.codes.length<count&&typeof r.text==='string'&&r.text.trim()&&r.text.length<=500:r.codes.length===count)?r:null;}
function fit(){if(view!=='catalog'||innerWidth<=650)return;const grid=$('catalog');let size=16;grid.style.setProperty('--range-font',size+'px');const available=innerHeight-grid.getBoundingClientRect().top-12;while(grid.getBoundingClientRect().height>available&&size>8){size-=.25;grid.style.setProperty('--range-font',size+'px');}}
function render(){
if(!exam||expired)return;
for(const v of ['selected','catalog']){$(v+'-view').setAttribute('aria-pressed',String(view===v));$(v+'-panel').hidden=view!==v;}
document.querySelectorAll('[data-grade]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.grade)===grade)));
const schools=db.schools.filter(s=>(Array.isArray(s.grades)?s.grades:[1,2,3]).includes(grade));if(!schools.some(s=>s.id===school))school=schools[0]?.id||'';
$('schools').replaceChildren(...schools.map(s=>{const b=node('button',s.name);b.setAttribute('aria-pressed',String(s.id===school));b.onclick=()=>{school=s.id;render();};return b;}));
$('selection-heading').textContent=school?schools.find(s=>s.id===school).name+'　'+grade+'年生のテスト範囲':(loaded?'この学年の中学校はまだ登録されていません。':'中学校の範囲を読み込み中…');
const left=node('div',undefined,'column'),right=node('div',undefined,'column');$('selections').replaceChildren();
if(school){$('selections').append(left,right);order.forEach((id,i)=>{const subject=exam.subjects[id],section=node('section',undefined,'subject'),r=record(id);section.append(node('h3',subject.name));if(r){(exam.common?.[grade]?.[id]||[]).forEach(u=>section.append(unit(u,true)));subject.units[grade].filter(u=>r.codes.includes(u[0])).forEach(u=>section.append(unit(u)));if(r.kind==='alternate'){const alt=node('div',undefined,'unit alternate');alt.append(node('strong','別版'),node('div',r.text));section.append(alt);}}else section.append(node('p','未決定','pending'));(i<3?left:right).append(section);});}
$('catalog').replaceChildren(...order.map(id=>{const subject=exam.subjects[id],section=node('section',undefined,'subject'),h=node('h3',subject.name),common=exam.common?.[grade]?.[id]||[];h.append(node('span',(common.length?'共通＋':'')+(exam.selectionCounts?.[grade]?.[id]||2)+'題選択'));section.append(h);common.forEach(u=>section.append(unit(u,true)));subject.units[grade].forEach(u=>section.append(unit(u)));return section;}));requestAnimationFrame(fit);
}
async function refresh(){if(busy||expired)return;busy=true;$('refresh').disabled=true;$('status').textContent='最新の範囲を確認しています…';try{const response=await fetch('/api/state?'+new URLSearchParams({campus,exam:exam.id}));const result=await response.json();if(!response.ok||!result.data)throw Error();db=result.data;loaded=true;render();$('status').textContent='最新の保存内容を表示しています。';}catch{if(!expired)$('status').textContent='最新の範囲を読み込めませんでした。「最新の範囲に更新」を押してください。';}finally{busy=false;$('refresh').disabled=false;}}
window.addEventListener('exam-changed',()=>{expired=true;});window.addEventListener('resize',fit);document.fonts.ready.then(fit);
document.querySelectorAll('[data-grade]').forEach(b=>b.onclick=()=>{grade=Number(b.dataset.grade);render();});
for(const v of ['selected','catalog'])$(v+'-view').onclick=()=>{view=v;render();};$('refresh').onclick=refresh;
async function init(){try{const response=await fetch('campuses.json',{cache:'no-store'});if(!response.ok)throw Error();const campuses=await response.json();if(!campus||!Object.hasOwn(campuses,campus)){$('status').textContent='校舎専用のURLから開いてください。URLが分からない場合は先生に確認してください。';return;}$('campus-name').textContent=campuses[campus];document.title=campuses[campus]+'｜生徒用 テスト範囲';exam=await CurrentExam.load();$('exam-title').textContent=exam.title;$('app').hidden=false;render();await refresh();}catch{$('status').textContent='範囲表を読み込めませんでした。画面を再読み込みしてください。';}}
init();
})();