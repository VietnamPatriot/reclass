import { popularSearches } from './data.js';
import { normalize } from './tags.js';
import { suggestionsFor } from './search.js';
import { $, html, icon } from './views.js';

export function readList(key) {
  try {
    const values=JSON.parse(localStorage.getItem(key)||'[]');
    return Array.isArray(values)?values.filter(value=>typeof value==='string'):[];
  } catch { return []; }
}

export function storeList(key, values) {
  try { localStorage.setItem(key,JSON.stringify(values)); } catch {}
}

export function initAutocomplete(input,{onInput,onSubmit}) {
  const box=$('#search-results');
  const options=$('#search-options');
  const clear=$('#clear-recent-searches');
  const row=input.closest('.search-row');
  const historyKey='reclass-recent-searches';
  let pool=[];
  let recent=readList(historyKey).slice(0,6);
  let selected=-1;
  let hint=0;

  function close() {
    box.hidden=true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    selected=-1;
  }
  function show() {
    const query=input.value.trim();
    const picks=suggestionsFor(pool,recent,query);
    const belongs=picks.some(item=>normalize(item.text)===normalize(query));
    if (query&&!belongs) picks.push({text:query,typed:true});
    if (!picks.length) return close();
    selected=-1;
    input.removeAttribute('aria-activedescendant');
    $('#search-title').textContent=query?'Gợi ý tìm kiếm':recent.length?'Gần đây & phổ biến':'Tìm kiếm phổ biến';
    clear.hidden=Boolean(query||!recent.length);
    options.innerHTML=picks.map((item,i)=>`
      <li id="search-option-${i}" role="option" aria-selected="false" data-query="${html(item.text)}">
        ${icon(item.recent?'clock':'search')} <span>${item.typed?'Tìm “'+html(item.text)+'”':html(item.text)}</span>
      </li>`).join('');
    box.hidden=false;
    input.setAttribute('aria-expanded','true');
  }
  function changed() {
    onInput(input.value.trim());
    show();
  }
  function submit(text) {
    const query=text.trim().slice(0,100);
    if (!query) return;
    recent=[query,...recent.filter(item=>normalize(item)!==normalize(query))].slice(0,6);
    storeList(historyKey,recent);
    input.value=query;
    close();
    onSubmit(query);
  }
  function setHint() {
    const phrase=popularSearches[hint];
    input.placeholder='Tìm '+phrase[0].toLocaleLowerCase('vi-VN')+phrase.slice(1);
  }
  setHint();
  window.setInterval(()=>{
    if (document.hidden||input.value||document.activeElement===input) return;
    hint=(hint+1)%popularSearches.length;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setHint();
    input.classList.add('search-hint-fade');
    window.setTimeout(()=>{
      setHint();
      input.classList.remove('search-hint-fade');
    },115);
  },2850);

  input.addEventListener('input',event=>{ if(!event.isComposing) changed(); });
  input.addEventListener('compositionend',changed);
  input.addEventListener('focus',show);
  input.addEventListener('keydown',event=>{
    if (event.isComposing) return;
    if (event.key==='Escape'&&!box.hidden) {
      event.preventDefault();
      return close();
    }
    if (event.key==='Enter') {
      event.preventDefault();
      return submit((!box.hidden&&options.children[selected]?.dataset.query)||input.value);
    }
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    if (box.hidden) show();
    const length=options.children.length;
    if (box.hidden||!length) return;
    event.preventDefault();
    const step=event.key==='ArrowDown'?1:-1;
    selected=selected===-1 ? (step>0?0:length-1) : (selected+step+length)%length;
    Array.from(options.children).forEach((item,i)=>item.setAttribute('aria-selected',i===selected));
    input.setAttribute('aria-activedescendant',options.children[selected].id);
    options.children[selected].scrollIntoView({block:'nearest',behavior:'instant'});
  });
  options.addEventListener('mousedown',event=>event.preventDefault());
  options.addEventListener('click',event=>{
    const item=event.target.closest('[data-query]');
    if (item) submit(item.dataset.query);
  });
  clear.addEventListener('click',()=>{
    recent=[];
    storeList(historyKey,recent);
    input.focus();
    show();
  });
  document.addEventListener('pointerdown',event=>{ if(!row.contains(event.target)) close(); });
  document.addEventListener('focusin',event=>{ if(!row.contains(event.target)) close(); });

  return { close, update(next) {pool=next;if(!box.hidden||document.activeElement===input) show();} };
}
