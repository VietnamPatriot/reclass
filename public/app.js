import { categories, conditions, schools, sampleListings, sampleSellers, sampleReviews } from './data.js';
import {
  $, icon, browsePath, catalogTagFilters, catalogCount, listingCards, footer, home,
  detail, catalog, storefront, unavailable, pageLoading
} from './views.js';
import { categoryForTag } from './tags.js';
import { indexListings, rankListings, suggestionPool } from './search.js';
import { initAutocomplete, readList, storeList } from './autocomplete.js';
import { createWorkflows } from './workflows.js';

const main=$('#main');
const search=$('#search');
const school=$('#school-filter');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const path=location.pathname.replace(/\/+$/,'')||'/';
const [,route,slug]=path.split('/');
const routeId=(()=>{try{return decodeURIComponent(slug||'');}catch{return slug;}})();
const params=new URLSearchParams(location.search);
const initialTag=params.get('the')||'';
const categoryParam=params.get('danhmuc');
const category=categories.some(cat=>cat.id===categoryParam)?categoryParam:categoryForTag(initialTag);
const filters={
  category,
  tag:categoryForTag(initialTag)===category?initialTag:'',
  query:(params.get('q')||'').slice(0,100),
  condition:conditions.includes(params.get('tinhtrang'))?params.get('tinhtrang'):'',
  budget:['50000','100000','200000'].includes(params.get('gia'))?params.get('gia'):'',
  sort:['new','low','high'].includes(params.get('sapxep'))?params.get('sapxep'):'',
  saved:path==='/da-luu'
};
const onCatalog=path==='/kham-pha'||filters.saved;
const product=route==='san-pham'&&routeId;
const shop=route==='gian-hang'&&routeId;
const savedKey='reclass-saved';
const viewKey='reclass-recent-views';
const pageSize=12;
const state={
  items:sampleListings,index:indexListings(sampleListings),session:null,featured:'',detail:null,seller:null,
  ready:false,visible:pageSize,tab:'description',photo:0
};
let saved=new Set(readList(savedKey));
let toastTimer, searchTimer, tabHeight, tabLoad, panelFade, photoRequest;
const workflow=createWorkflows({api,notify,getSession:()=>state.session,setProfile:profile=>{state.session.profile=profile;updateHeader();},refresh});

async function api(endpoint, data) {
  const options=data===undefined?{}:data instanceof FormData?{method:'POST',body:data}:
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const response=await fetch(endpoint,options);
  const result=await response.json().catch(()=>null);
  if (!response.ok||result===null) throw new Error(result?.error||'Không thể kết nối với RE:CLASS. Hãy thử lại.');
  return result;
}
function notify(message) {
  const node=$('#toast');
  node.textContent=message;
  node.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{node.hidden=true;},4500);
}
function updateHeader() {
  $('[data-action=account]').textContent=state.session?.signed?'Tài khoản':'Đăng nhập';
  document.querySelectorAll('nav a').forEach(link=>{
    const current=path==='/'?'/':onCatalog?'/kham-pha':'';
    if (link.getAttribute('href')===current) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
}
function shopFixture(id) {
  const seller=sampleSellers.find(person=>person.id===id);
  if (!seller) return null;
  const reviews=sampleReviews.filter(review=>review.seller===id);
  return {...seller,listings:sampleListings.filter(item=>item.sellerId===id),reviews,rating:reviews.length?5:null};
}
function updateTheme(next) {
  document.documentElement.dataset.theme=next;
  try {localStorage.setItem('reclass-theme',next);} catch {}
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.themeChoice===next));
}

function availableIndex() {
  return state.index.filter(({item})=>(!school.value||item.school===school.value)&&
    (!onCatalog||((!filters.category||item.category===filters.category)&&(!filters.tag||item.tags?.includes(filters.tag))&&
      (!filters.condition||item.condition===filters.condition)&&(!filters.budget||item.price<=Number(filters.budget))&&
      (!filters.saved||saved.has(item.id)))));
}
function catalogItems() {
  const items=rankListings(availableIndex(),filters.query);
  if (filters.sort==='new') items.sort((a,b)=>(b.created||'').localeCompare(a.created||''));
  if (filters.sort==='low'||filters.sort==='high') items.sort((a,b)=>filters.sort==='low'?a.price-b.price:b.price-a.price);
  return items;
}
function syncCatalogUrl() {
  const url=new URL(browsePath(filters.category,filters.query,filters.tag),location.origin);
  if (filters.saved) url.pathname=path;
  for (const [key,value] of Object.entries({truong:school.value,tinhtrang:filters.condition,gia:filters.budget,sapxep:filters.sort})) {
    if (value) url.searchParams.set(key,value);
  }
  history.replaceState(history.state,'',url);
}
function animateGrid(node) {
  if (!node||motion.matches) return;
  node.animate([{opacity:.65,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:175,easing:'ease-out'});
}
function renderCatalog(animate=false) {
  const items=catalogItems();
  $('#catalog-count').textContent=catalogCount(items.length,filters.query);
  const list=$('#catalog-list');
  list.innerHTML=listingCards(items.slice(0,state.visible),saved);
  if(animate) animateGrid(list.firstElementChild);
  const tagContainer=$('#catalog-tags');
  if (tagContainer.dataset.category!==filters.category) {
    tagContainer.innerHTML=catalogTagFilters(filters.category,filters.tag);
    tagContainer.dataset.category=filters.category;
  }
  document.querySelectorAll('#catalog-pills [data-action=filter]').forEach(button=>button.setAttribute('aria-pressed',filters.category===button.dataset.id));
  tagContainer.querySelectorAll('[data-action=tag-filter]').forEach(button=>button.setAttribute('aria-pressed',filters.tag===button.dataset.id));
  $('[data-action=clear-filters]').hidden=!(filters.query||filters.category||filters.tag||filters.condition||filters.budget||filters.sort||school.value);
  const more=$('[data-action=load-more]');
  more.hidden=items.length<=state.visible;
  more.textContent='Xem thêm ('+Math.max(0,items.length-state.visible)+')';
}
function filterChanged({animate=true, rebuildSuggestions=true}={}) {
  state.visible=pageSize;
  renderCatalog(animate);
  syncCatalogUrl();
  if(rebuildSuggestions) autocomplete.update(suggestionPool(availableIndex()));
}
function populateSchools(selected) {
  const options=[...new Set([...schools,...state.items.map(item=>item.school)])];
  school.options.length=1;
  options.forEach(value=>school.add(new Option(value,value)));
  school.value=options.includes(selected)?selected:'';
}
function startNavigation() {
  document.documentElement.classList.add('is-navigating');
}
function submitSearch(query) {
  clearTimeout(searchTimer);
  if (onCatalog) {
    filters.query=query;
    filterChanged({rebuildSuggestions:false});
    return;
  }
  const url=new URL(browsePath('',query),location.origin);
  if (school.value) url.searchParams.set('truong',school.value);
  startNavigation();
  location.assign(url);
}
const autocomplete=initAutocomplete(search,{
  onInput(query) {
    if (!onCatalog) return;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{
      filters.query=query;
      filterChanged({animate:false,rebuildSuggestions:false});
    },110);
  },
  onSubmit:submitSearch
});

function relatedTo(item) {
  const tags=new Set(item.tags||[]);
  return state.items.filter(other=>other.id!==item.id).map(other=>({
    item:other, relevance:(other.category===item.category?1:0)+(other.tags||[]).filter(value=>tags.has(value)).length*2
  })).sort((a,b)=>b.relevance-a.relevance).slice(0,4).map(result=>result.item);
}
function render() {
  if (path==='/') {
    const byId=new Map(state.items.map(item=>[item.id,item]));
    const recent=readList(viewKey).map(id=>byId.get(id)).filter(Boolean).slice(0,4);
    main.innerHTML=home(state.items,saved,state.featured,recent);
  } else if (onCatalog) {
    main.innerHTML=catalog(filters);
    for (const field of ['sort','condition','budget']) $('#'+field).value=filters[field];
    renderCatalog();
  } else if (product) {
    const item=state.detail?.item||sampleListings.find(item=>item.id===product);
    const seller=state.detail?.seller||shopFixture(item?.sellerId);
    if (item&&seller) {
      const focusedTab=document.activeElement?.getAttribute('role')==='tab';
      document.title=item.title+' · RE:CLASS';
      main.innerHTML=detail(item,seller,seller.reviews,relatedTo(item),saved,seller.listings.length,state.session?.profile);
      applyTab(state.tab,focusedTab);
      applyPhoto(item,Math.min(state.photo,item.images.length-1));
      storeList(viewKey,[item.id,...readList(viewKey).filter(id=>id!==item.id)].slice(0,12));
    } else main.innerHTML=state.ready?unavailable():pageLoading();
  } else if (shop) {
    const seller=state.seller||shopFixture(shop);
    if (seller) {
      document.title=seller.shop+' · RE:CLASS';
      main.innerHTML=storefront(seller,seller.listings,seller.reviews,saved);
    } else main.innerHTML=state.ready?unavailable():pageLoading();
  } else main.innerHTML=unavailable();
}
async function refresh() {
  const requests=[api('/api/session'),api('/api/listings')];
  if (product) requests.push(api('/api/listings/'+encodeURIComponent(product)));
  else if (shop) requests.push(api('/api/sellers/'+encodeURIComponent(shop)));
  const [session,items,page]=await Promise.allSettled(requests);
  if (session.status==='fulfilled') state.session=session.value;
  if (items.status==='fulfilled') {
    state.items=items.value;
    state.index=indexListings(state.items);
    populateSchools(school.value);
  }
  if (page) {
    if (product) state.detail=page.status==='fulfilled'?page.value:null;
    else state.seller=page.status==='fulfilled'?page.value:null;
  }
  state.ready=true;
  updateHeader();
  if (onCatalog&&$('#catalog-list')) renderCatalog(); else render();
  autocomplete.update(suggestionPool(availableIndex()));
}

function applyTab(id,focus=false) {
  document.querySelectorAll('[data-action=tab]').forEach(button=>{
    const active=button.dataset.id===id;
    button.setAttribute('aria-selected',active);
    button.tabIndex=active?0:-1;
    document.getElementById('panel-'+button.dataset.id).hidden=!active;
    if (active&&focus) button.focus({preventScroll:true});
  });
}
function switchTab(id,focus=false) {
  if (state.tab===id) return applyTab(id,focus);
  const stage=$('.tab-stage');
  const before=stage.getBoundingClientRect().height;
  tabHeight?.cancel();
  tabLoad?.cancel();
  panelFade?.cancel();
  stage.classList.remove('resizing');
  state.tab=id;
  applyTab(id,focus);
  if (motion.matches) return;

  const after=stage.getBoundingClientRect().height;
  stage.classList.add('resizing');
  tabHeight=stage.animate([{height:before+'px'},{height:after+'px'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});
  tabHeight.onfinish=()=>stage.classList.remove('resizing');
  tabLoad=stage.querySelector('.tab-loader').animate([{opacity:0},{opacity:1,offset:.22},{opacity:.85,offset:.6},{opacity:0}],{duration:155,easing:'ease-out'});
  panelFade=document.getElementById('panel-'+id).animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:150,delay:90,fill:'backwards',easing:'ease-out'});
}
function applyPhoto(item,index) {
  const src=item.images[index];
  const image=$('#detail-image');
  if (image.getAttribute('src')!==src) image.src=src;
  $('#photo-count').textContent=(index+1)+' / '+item.images.length;
  document.querySelectorAll('[data-action=photo]').forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.id)===index));
}
async function choosePhoto(index) {
  const item=state.detail?.item||sampleListings.find(listing=>listing.id===product);
  if (!item?.images[index]) return;
  const request=Symbol();
  photoRequest=request;
  if(state.photo===index) return;
  const image=new Image();
  image.src=item.images[index];
  try { await image.decode(); } catch { return; }
  if (request!==photoRequest) return;
  state.photo=index;
  applyPhoto(item,index);
  if (!motion.matches) $('#detail-image').animate([{opacity:.52},{opacity:1}],{duration:185,easing:'ease-out'});
}

function renderFeatured() {
  $('#featured-pills').querySelectorAll('.pill').forEach(pill=>pill.setAttribute('aria-pressed',state.featured===pill.dataset.id));
  const list=$('#featured-list');
  list.innerHTML=listingCards(state.items.filter(item=>!state.featured||item.category===state.featured).slice(0,4),saved);
  animateGrid(list.firstElementChild);
}
function save(id) {
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  storeList(savedKey,[...saved]);
  document.querySelectorAll('[data-action=save]').forEach(button=>{
    if (button.dataset.id!==id) return;
    button.setAttribute('aria-pressed',saved.has(id));
    const label=button.querySelector('span');
    if (label) label.textContent=saved.has(id)?'Đã lưu':'Lưu tin';
  });
  if (filters.saved) {
    renderCatalog();
    autocomplete.update(suggestionPool(availableIndex()));
  }
  notify(saved.has(id)?'Đã lưu tin.':'Đã bỏ lưu tin.');
}
async function share() {
  try {
    if (navigator.share) await navigator.share({title:document.title,url:location.href});
    else { await navigator.clipboard.writeText(location.href);notify('Đã sao chép đường dẫn.'); }
  }catch(error){if(error.name!=='AbortError') workflow.showLink(location.href);}
}
function clearFilters() {
  clearTimeout(searchTimer);
  for (const key of ['category','tag','query','condition','budget','sort']) filters[key]='';
  search.value='';
  school.value='';
  for (const field of ['sort','condition','budget']) $('#'+field).value='';
  filterChanged();
  $('#catalog-pills button').focus();
}

school.addEventListener('change',()=>{
  if (onCatalog) filterChanged();
  else autocomplete.update(suggestionPool(availableIndex()));
});
document.addEventListener('change',event=>{
  const {id,value}=event.target;
  if (!onCatalog||!['sort','condition','budget'].includes(id)) return;
  filters[id]=value;
  filterChanged();
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
  const link=event.target.closest('a[href]');
  if (link&&!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&!link.target&&!link.hasAttribute('download')) {
    const next=new URL(link.href);
    if(next.origin===location.origin&&(next.pathname!==location.pathname||next.search!==location.search)) startNavigation();
  }
  const theme=event.target.closest('[data-theme-choice]');
  if (theme) return updateTheme(theme.dataset.themeChoice);
  const button=event.target.closest('button[data-action]');
  if (!button) return;
  const {action,id}=button.dataset;
  try {
    if (action==='featured') {
      state.featured=id;
      renderFeatured();
    } else if (action==='filter') {
      filters.category=id;
      filters.tag='';
      filterChanged();
    } else if (action==='tag-filter') {
      if(filters.tag===id) filters.tag='';
      else {filters.tag=id;filters.category=categoryForTag(id);}
      filterChanged();
      if (!button.isConnected) $('#catalog-tags [data-id="'+id+'"]')?.focus();
    } else if (action==='clear-filters') clearFilters();
    else if (action==='load-more') {
      const firstNew=state.visible;
      state.visible+=pageSize;
      renderCatalog();
      const first=$('#catalog-list .listing-grid').children[firstNew];
      first?.querySelector('a').focus({preventScroll:true});
      first?.scrollIntoView({block:'nearest'});
    } else if (action==='clear-views') {
      storeList(viewKey,[]);
      $('.recent-listings').remove();
      notify('Đã xóa lịch sử xem.');
      $('.why button').focus({preventScroll:true});
    } else if (action==='category-scroll') {
      const track=$('.category-track');
      const gap=Number.parseFloat(getComputedStyle(track).columnGap)||0;
      track.scrollBy({left:Number(id)*(track.firstElementChild.getBoundingClientRect().width+gap)});
    } else if (action==='save') save(id);
    else if (action==='share') await share();
    else if (action==='tab') switchTab(id);
    else if (action==='photo') await choosePhoto(Number(id));
    else if (action==='contact'&&((state.detail?.item||sampleListings.find(item=>item.id===id))?.sample)) {
      workflow.showSample();
    } else await workflow.handle(action,id,button);
  }catch(error){notify(error.message);}
});
window.addEventListener('pageshow',event=>{
  document.documentElement.classList.remove('is-navigating');
  if (event.persisted) {
    saved=new Set(readList(savedKey));
    render();
  }
});

$('.search-icon').innerHTML=icon('search');
for (const button of document.querySelectorAll('[data-theme-choice]')) button.innerHTML=icon(button.dataset.themeChoice==='dark'?'moon':'sun');
updateTheme(document.documentElement.dataset.theme);
$('#footer').innerHTML=footer();
search.value=filters.query;
populateSchools(params.get('truong'));
autocomplete.update(suggestionPool(availableIndex()));
updateHeader();
render();
refresh().then(()=>{
  const anchor=location.hash.slice(1);
  if(anchor) document.getElementById(anchor)?.scrollIntoView({behavior:'instant'});
});
