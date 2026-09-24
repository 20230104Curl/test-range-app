'use strict';
window.CurrentExam=(()=>{
  let currentId='',expired=false,checking=false,lastCheck=0,timer;
  function expire(){
    if(expired)return;expired=true;clearInterval(timer);
    document.title='新しい回の範囲表に切り替わりました';
    window.dispatchEvent(new Event('exam-changed'));
    const main=document.createElement('main'),title=document.createElement('h1'),message=document.createElement('p'),link=document.createElement('a');
    title.textContent='新しい回の範囲表に切り替わりました';message.textContent='最新の範囲表を開いてください。';link.textContent='最新の範囲を開く';link.href=location.href;
    main.style.cssText='max-width:760px;margin:60px auto;padding:24px';main.append(title,message,link);
    // Keep element references alive for any in-flight request, but hide the old screen.
    for(const child of document.body.children){child.hidden=true;child.setAttribute('inert','');}
    document.body.append(main);
  }
  async function check(force=false){
    if(!currentId||expired||checking||document.hidden||(!force&&Date.now()-lastCheck<10000))return;
    checking=true;lastCheck=Date.now();
    try{const r=await fetch('/api/catalog');const result=await r.json();if(r.ok&&result.exam?.id!==currentId)expire();}catch{}finally{checking=false;}
  }
  async function load(){
    const r=await fetch('/api/catalog');const result=await r.json();
    if(!r.ok||!result.exam?.subjects)throw Error(result.error||'範囲表を読み込めませんでした。');
    currentId=result.exam.id;lastCheck=Date.now();clearInterval(timer);timer=setInterval(check,60000);return result.exam;
  }
  document.addEventListener('visibilitychange',()=>check());window.addEventListener('focus',()=>check());window.addEventListener('pageshow',()=>check());
  window.addEventListener('storage',e=>{if(e.key==='test-range-current-id')check(true);});
  return {load,expire,check};
})();
