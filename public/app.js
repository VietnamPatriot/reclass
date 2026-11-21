import { categories, schools, sampleListings, sampleSellers, sampleReviews } from './data.js';
import { $, html, money, icon, browsePath, productPath, catalogCount, listingCards, pills, footer, home, detail, catalog, storefront, unavailable } from './views.js';
import { createWorkflows } from './workflows.js';

const main=$('#main');
const search=$('#search');
const searchBox=$('#search-results');
const school=$('#school-filter');
const path=location.pathname.replace(/\/+$/,'')||'/';
const route=path.split('/').slice(1).map(part=>{
  try { return decodeURIComponent(part); } catch { return part; }
});
const params=new URLSearchParams(location.search);
const state={items:sampleListings, session:null, featured:'', sort:'new', selected:-1, detail:null, seller:null, online:false};
let toastTimer;
let saved=new Set();
try { const values=JSON.parse(localStorage.getItem('reclass-saved')||'[]'); if (Array.isArray(values)) saved=new Set(values); } catch {}
const categoryParam=params.get('danhmuc');
const filters={category:categories.some(cat=>cat.id===categoryParam)?categoryParam:'',query:(params.get('q')||'').slice(0,100),saved:path==='/da-luu'};
const onCatalog=path==='/kham-pha'||filters.saved;
const product=route[0]==='san-pham'&&route[1];
const shop=route[0]==='gian-hang'&&route[1];

export async function api(endpoint, data) {
  const options=data===undefined?{}:data instanceof FormData?{method:'POST',body:data}:
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const response=await fetch(endpoint,options);
  const result=await response.json().catch(()=>null);
  if (!response.ok||result===null) throw new Error(result?.error||'Không thể kết nối với RE:CLASS. Hãy thử lại.');
  return result;
}
export function notify(message) {
  const node=$('#toast');
  node.textContent=message;
  node.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{node.hidden=true;},4500);
}
const workflow=createWorkflows({api,notify,getSession:()=>state.session,setProfile:profile=>{state.session.profile=profile;updateHeader();},refresh});

function updateHeader() {
  $('[data-action=account]').textContent=state.session?.signed?'Tài khoản':'Đăng nhập';
  document.querySelectorAll('nav a').forEach(link=>{
    if (link.getAttribute('href')===(path==='/'?'/':onCatalog?'/kham-pha':'none')) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
}
function shopFixture(id) {
  const seller=sampleSellers.find(person=>person.id===id);
  return seller?{...seller,listingCount:sampleListings.filter(listing=>listing.sellerId===id).length,listings:sampleListings.filter(listing=>listing.sellerId===id),reviews:sampleReviews.filter(review=>review.seller===id),rating:5}:null;
}
function updateTheme(next) {
  document.documentElement.dataset.theme=next;
  try {localStorage.setItem('reclass-theme',next);} catch {}
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.themeChoice===next));
}
function words(value) {
  return value.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/\p{Diacritic}/gu,'').replaceAll('đ','d').split(/\s+/).filter(Boolean);
}
function searchMatches(items,query) {
  const terms=words(query);
  return items.filter(item=>{
    if (school.value&&item.school!==school.value) return false;
    if (!terms.length) return true;
    const candidate=words([item.title,item.keywords,item.description,item.school,categories.find(cat=>cat.id===item.category)?.name].filter(Boolean).join(' ')).join(' ');
    return terms.every(term=>candidate.includes(term));
  });
}
function catalogItems() {
  const active=state.items.filter(item=>(!filters.category||item.category===filters.category)&&(!filters.saved||saved.has(item.id)));
  const items=searchMatches(active,filters.query);
  if (state.sort!=='new') items.sort((a,b)=>state.sort==='low'?a.price-b.price:b.price-a.price);
  return items;
}
function renderCatalog() {
  const items=catalogItems();
  $('#catalog-count').innerHTML=catalogCount(items,filters.query);
  $('#catalog-list').innerHTML=listingCards(items,saved);
  $('#catalog-pills').querySelectorAll('.pill').forEach(button=>button.setAttribute('aria-pressed',filters.category===button.dataset.id));
}
function render() {
  if (path==='/') main.innerHTML=home(state.items,saved,state.featured);
  else if (onCatalog) {
    main.innerHTML=catalog(catalogItems(),saved,filters);
    $('#sort').value=state.sort;
  } else if (product) {
    const item=state.detail?.item||sampleListings.find(item=>item.id===product);
    const seller=state.detail?.seller||shopFixture(item?.sellerId);
    if (item&&seller) {
      document.title=item.title+' · RE:CLASS';
      main.innerHTML=detail(item,seller,seller.reviews,state.items.filter(other=>other.id!==item.id).slice(0,4),saved,seller.listings.length,state.session?.profile);
      return;
    }
    main.innerHTML=state.online?unavailable():'<section class="section wrap"><p>Đang tải tin đăng…</p></section>';
  } else if (shop) {
    const seller=state.seller||shopFixture(shop);
    if (seller) {
      document.title=seller.shop+' · RE:CLASS';
      main.innerHTML=storefront(seller,seller.listings,seller.reviews,saved);
      return;
    }
    main.innerHTML=state.online?unavailable():'<section class="section wrap"><p>Đang tải gian hàng…</p></section>';
  } else main.innerHTML=unavailable();
}
async function refresh(){
  const requests=[api('/api/session'),api('/api/listings')];
  if (product) requests.push(api('/api/listings/'+encodeURIComponent(product)));
  else if (shop) requests.push(api('/api/sellers/'+encodeURIComponent(shop)));
  const [session,items,page]=await Promise.allSettled(requests);
  if (session.status==='fulfilled') state.session=session.value;
  if (items.status==='fulfilled') {
    state.items=items.value;
    const values=[...new Set([...schools,...state.items.map(item=>item.school)])];
    const selectedSchool=school.value||params.get('truong')||'';
    school.options.length=1;
    values.forEach(value=>school.add(new Option(value,value)));
    if(values.includes(selectedSchool)) school.value=selectedSchool;
  }
  if (page?.status==='fulfilled') {
    if (product) state.detail=page.value;
    else state.seller=page.value;
  }
  state.online=true;
  updateHeader();
  if (onCatalog&&$('#catalog-list')) renderCatalog(); else render();
  if (document.activeElement===search) showSearch();
}
function closeSearch() {
  searchBox.hidden=true;
  search.setAttribute('aria-expanded','false');
  search.removeAttribute('aria-activedescendant');
  state.selected=-1;
}
function currentBrowse(query) {
  const url=new URL(browsePath(filters.category,query),location.origin);
  if (school.value) url.searchParams.set('truong',school.value);
  return url.pathname+url.search;
}
function showSearch() {
  const query=search.value.trim();
  if (!query&&!school.value) return closeSearch();
  const items=searchMatches(state.items,query).slice(0,5);
  state.selected=-1;
  search.removeAttribute('aria-activedescendant');
  searchBox.innerHTML='<div role="listbox" aria-label="Kết quả tìm kiếm">'+items.map((item,i)=>`<a id="result-${i}" role="option" aria-selected="false" href="${productPath(item.id)}"><img src="${html(item.images[0])}" alt=""><span><strong>${html(item.title)}</strong><small>${money(item.price)} · ${html(item.school)}</small></span></a>`).join('')+'</div>'+
    (items.length?'':'<p class="small-note">Chưa tìm thấy món đồ phù hợp.</p>')+'<a class="browse-search" href="'+html(currentBrowse(query))+'">Xem kết quả tìm kiếm</a>';
  searchBox.hidden=false;
  search.setAttribute('aria-expanded','true');
}
function switchTab(id,focus=false) {
  document.querySelectorAll('[data-action=tab]').forEach(button=>{
    const active=button.dataset.id===id;
    button.setAttribute('aria-selected',active);
    button.tabIndex=active?0:-1;
    document.getElementById('panel-'+button.dataset.id).hidden=!active;
    if (active&&focus) button.focus();
  });
}
function save(id) {
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  try {localStorage.setItem('reclass-saved',JSON.stringify([...saved]));} catch {}
  document.querySelectorAll('[data-action=save]').forEach(button=>{
    if (button.dataset.id!==id) return;
    button.setAttribute('aria-pressed',saved.has(id));
    const label=button.querySelector('span');
    if (label) label.textContent=saved.has(id)?'Đã lưu':'Lưu tin';
  });
  if (filters.saved) renderCatalog();
  notify(saved.has(id)?'Đã lưu tin.':'Đã bỏ lưu tin.');
}
async function share() {
  try {
    if (navigator.share) await navigator.share({title:document.title,url:location.href});
    else { await navigator.clipboard.writeText(location.href);notify('Đã sao chép đường dẫn.'); }
  }catch(error){if(error.name!=='AbortError') workflow.showLink(location.href);}
}
search.value=filters.query;
search.addEventListener('input',()=>{
  search.value=search.value.slice(0,100);
  if (onCatalog) {filters.query=search.value.trim();renderCatalog();}
  showSearch();
});
search.addEventListener('focus',showSearch);
search.addEventListener('keydown',event=>{
  const results=[...searchBox.querySelectorAll('[role=option]')];
  if (event.key==='Escape') return closeSearch();
  if (event.key==='Enter') {
    const option=results[state.selected];
    if ((search.value.trim()||school.value)&&!searchBox.hidden) location.assign(option?.href||currentBrowse(search.value.trim()));
    return;
  }
  if ((event.key!=='ArrowDown'&&event.key!=='ArrowUp')||!results.length||searchBox.hidden) return;
  event.preventDefault();
  state.selected=(state.selected+(event.key==='ArrowDown'?1:state.selected<0?0:-1)+results.length)%results.length;
  results.forEach((option,i)=>option.setAttribute('aria-selected',i===state.selected));
  search.setAttribute('aria-activedescendant',results[state.selected].id);
});
school.addEventListener('change',()=>{
  if (onCatalog) renderCatalog();
  else showSearch();
});
document.addEventListener('change',event=>{
  if (event.target.id==='sort') {state.sort=event.target.value;renderCatalog();}
});
document.addEventListener('keydown',event=>{
  if (event.target.getAttribute?.('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const tabs=[...document.querySelectorAll('[role=tab]')];
  const i=tabs.indexOf(event.target);
  const next={Home:0,End:tabs.length-1,ArrowLeft:(i+tabs.length-1)%tabs.length,ArrowRight:(i+1)%tabs.length}[event.key];
  event.preventDefault();
  switchTab(tabs[next].dataset.id,true);
});
document.addEventListener('click',async event=>{
  if (!event.target.closest('.search-row')) closeSearch();
  const theme=event.target.closest('[data-theme-choice]');
  if (theme) return updateTheme(theme.dataset.themeChoice);
  const button=event.target.closest('button[data-action]');
  if (!button) return;
  const {action,id}=button.dataset;
  try {
    if (action==='featured') {
      state.featured=id;
      $('#featured-pills').querySelectorAll('.pill').forEach(pill=>pill.setAttribute('aria-pressed',id===pill.dataset.id));
      $('#featured-list').innerHTML=listingCards(state.items.filter(item=>!id||item.category===id).slice(0,4),saved);
    } else if (action==='filter') {
      filters.category=id;renderCatalog();
      const url=new URL(currentBrowse(filters.query),location.origin);
      if (filters.saved) url.pathname='/da-luu';
      history.replaceState({},'',url);
    } else if (action==='category-scroll') {
      const track=$('.category-track');
      track.scrollBy({left:Number(id)*(track.firstElementChild.getBoundingClientRect().width+16)});
    } else if (action==='save') save(id);
    else if (action==='share') await share();
    else if (action==='tab') switchTab(id);
    else if (action==='photo') {
      const item=state.detail?.item||sampleListings.find(item=>item.id===product);
      $('#detail-image').src=item.images[Number(id)];
      $('#photo-count').textContent=(Number(id)+1)+' / '+item.images.length;
      document.querySelectorAll('[data-action=photo]').forEach(control=>control.setAttribute('aria-pressed',control===button));
    } else if (action==='contact'&&((state.detail?.item||sampleListings.find(item=>item.id===id))?.sample)) {
      workflow.showSample();
    } else await workflow.handle(action,id,button);
  }catch(error){notify(error.message);}
});

$('.search-icon').innerHTML=icon('search');
for (const button of document.querySelectorAll('[data-theme-choice]')) button.innerHTML=icon(button.dataset.themeChoice==='dark'?'moon':'sun');
updateTheme(document.documentElement.dataset.theme);
$('#footer').innerHTML=footer();
updateHeader();
render();
refresh().then(()=>{
  const anchor=location.hash.slice(1);
  if(anchor) document.getElementById(anchor)?.scrollIntoView({behavior:'instant'});
});
