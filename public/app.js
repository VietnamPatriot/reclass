import { categories, conditions, schools, sampleListings, sampleSellers, sampleReviews, reviewSummary } from './catalog/data.js';
import {
  $, icon, money, browsePath, catalogTagFilters, catalogCount, listingCards, footer, home,
  detail, catalog, storefront, unavailable, pageLoading, priceFilterLabel
} from './views.js';
import { categoryForTag } from './catalog/tags.js';
import { activeOffer, countdown, effectivePrice, priceLimit } from './catalog/offers.js';
import { indexListings, rankListings, suggestionPool } from './catalog/search.js';
import { initAutocomplete, readList, storeList } from './autocomplete.js';
import { createWorkflows } from './workflows.js';
import { accountPage, authPage, cartPage } from './account-views.js';

const main=$('#main');
const search=$('#search');
const school=$('#school-filter');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const path=location.pathname.replace(/\/+$/,'')||'/';
const [,route,slug]=path.split('/');
const routeId=(()=>{try{return decodeURIComponent(slug||'');}catch{return slug;}})();
const params=new URLSearchParams(location.search);
const initialTag=params.get('the')||'';
const tagCategory=categoryForTag(initialTag);
const categoryParam=params.get('danhmuc');
const category=categories.some(cat=>cat.id===categoryParam)?categoryParam:tagCategory;
const minPrice=priceLimit(params.get('gia-tu'));
const maxPrice=priceLimit(params.get('gia'));
const filters={
  category,
  tag:tagCategory&&tagCategory===category?initialTag:'',
  query:(params.get('q')||'').slice(0,100),
  condition:conditions.includes(params.get('tinhtrang'))?params.get('tinhtrang'):'',
  minPrice:minPrice&&maxPrice&&Number(minPrice)>Number(maxPrice)?'':minPrice,
  maxPrice,
  sale:params.get('giamgia')==='1',
  sort:['new','low','high'].includes(params.get('sapxep'))?params.get('sapxep'):'',
  saved:path==='/da-luu'
};
const onCatalog=path==='/kham-pha'||filters.saved;
const product=route==='san-pham'&&routeId;
const shop=route==='gian-hang'&&routeId;
const onAuth=path==='/dang-nhap'||path==='/dang-ky';
const onAccount=route==='tai-khoan';
const onProfile=path==='/tai-khoan/ho-so';
const onCart=path==='/gio-hang';
const cartKey='reclass-cart';
const savedKey='reclass-saved';
const viewKey='reclass-recent-views';
const pageSize=12;
const state={
  items:sampleListings,index:indexListings(sampleListings),session:null,featured:'',detail:null,seller:null,
  ready:false,visible:pageSize,tab:'description',photo:0
};
let saved=new Set(readList(savedKey));
let cart=new Set(readList(cartKey));
const cartSelection=new Set(cart);
let cartSending=false, accountData, accountRequest=0;
let toastTimer, searchTimer, tabHeight, tabLoad, panelFade, photoRequest, refreshNumber=0, offerTimeout;
const saving=new Set();
const workflow=createWorkflows({api,notify,getSession:()=>state.session,setProfile:profile=>{
  state.session.profile=profile;
  updateHeader();
  if (onCart) renderCart();
},refresh,refreshAccount});

async function api(endpoint, data) {
  const options=data===undefined?{}:data instanceof FormData?{method:'POST',body:data}:
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};
  const response=await fetch(endpoint,options);
  const result=await response.json().catch(()=>null);
  if (!response.ok||result===null) throw Object.assign(new Error(result?.error||'Không thể kết nối với RE:CLASS. Hãy thử lại.'),{status:response.status});
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
  const account=$('.account-trigger');
  account.href=state.session?.signed?'/tai-khoan':'/dang-nhap';
  if (onAuth||onAccount) account.setAttribute('aria-current','page');
  $('[data-action=inbox]').hidden=!state.session?.signed;
  $('.search-row').hidden=onAuth||(onAccount&&!state.session?.signed);
  document.querySelectorAll('.site-header nav a').forEach(link=>{
    const current=path==='/'?'/':onCatalog?'/kham-pha':'';
    if (link.getAttribute('href')===current) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  const count=$('.cart-count');
  count.textContent=cart.size;
  count.hidden=!cart.size;
  $('.header-cart').setAttribute('aria-label',cart.size?'Giỏ hàng, '+cart.size+' món':'Giỏ hàng');
  if (onCart) $('.header-cart').setAttribute('aria-current','page');
  const cartButton=$('[data-action=cart-add]');
  if (cartButton) {
    const added=cart.has(cartButton.dataset.id);
    cartButton.dataset.inCart=added;
    cartButton.querySelector('span').textContent=added?'Xem giỏ hàng':'Thêm vào giỏ';
  }
}
function shopFixture(id) {
  const seller=sampleSellers.find(person=>person.id===id);
  if (!seller) return null;
  const reviews=sampleReviews.filter(review=>review.seller===id);
  return {...seller,listings:sampleListings.filter(item=>item.sellerId===id),reviews,...reviewSummary(reviews)};
}
function updateTheme(next) {
  document.documentElement.dataset.theme=next;
  try {localStorage.setItem('reclass-theme',next);} catch {}
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.themeChoice===next));
}

function availableIndex() {
  const now=Date.now();
  const min=Number(filters.minPrice);
  const max=filters.maxPrice===''?Infinity:Number(filters.maxPrice);
  return state.index.filter(({item})=>{
    if(school.value&&item.school!==school.value) return false;
    if(!onCatalog) return true;
    const offer=activeOffer(item,now);
    const price=offer?.price??item.price;
    return (!filters.category||item.category===filters.category)&&(!filters.tag||item.tags?.includes(filters.tag))&&
      (!filters.condition||item.condition===filters.condition)&&price>=min&&price<=max&&(!filters.sale||offer)&&
      (!filters.saved||saved.has(item.id));
  });
}
function catalogItems() {
  const items=rankListings(availableIndex(),filters.query);
  if (filters.sort==='new') items.sort((a,b)=>(b.created||'').localeCompare(a.created||''));
  const now=Date.now();
  if (filters.sort==='low'||filters.sort==='high') {
    const direction=filters.sort==='low'?1:-1;
    items.sort((a,b)=>direction*(effectivePrice(a,now)-effectivePrice(b,now)));
  }
  return items;
}
function syncCatalogUrl() {
  const url=new URL(browsePath(filters.category,filters.query,filters.tag),location.origin);
  if (filters.saved) url.pathname=path;
  for (const [key,value] of Object.entries({truong:school.value,tinhtrang:filters.condition,'gia-tu':filters.minPrice,gia:filters.maxPrice,sapxep:filters.sort,giamgia:filters.sale?'1':''})) {
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
  if (tagContainer.dataset.category!==filters.category||tagContainer.dataset.tag!==filters.tag) {
    tagContainer.innerHTML=catalogTagFilters(filters.category,filters.tag);
    tagContainer.dataset.category=filters.category;
    tagContainer.dataset.tag=filters.tag;
  }
  document.querySelectorAll('#catalog-pills [data-action=filter]').forEach(button=>button.setAttribute('aria-pressed',filters.category===button.dataset.id));
  $('[data-action=sale-filter]').setAttribute('aria-pressed',filters.sale);
  const priceLabel=priceFilterLabel(filters.minPrice,filters.maxPrice);
  const priceSummary=$('#price-filter-summary');
  priceSummary.querySelector('span').textContent=priceLabel;
  priceSummary.title=priceLabel;
  priceSummary.classList.toggle('active',Boolean(filters.minPrice||filters.maxPrice));
  $('[data-action=clear-filters]').hidden=!(filters.query||filters.category||filters.tag||filters.condition||filters.minPrice||filters.maxPrice||filters.sort||filters.sale||school.value);
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
const accountCounts=()=>({cart:cart.size,saved:saved.size});

function renderAccount() {
  const profile=state.session?.profile;
  if (!state.ready) {main.innerHTML=pageLoading();return;}
  if (!profile) {
    document.title='Đăng nhập · RE:CLASS';
    if (!$('.auth-layout')) main.innerHTML=authPage(false);
    return;
  }
  const items=new Map([...state.items,...(accountData?.listings||[])].map(item=>[item.id,item]));
  document.title='Tài khoản · RE:CLASS';
  main.innerHTML=accountPage(path,profile,accountData,items,accountCounts(),params.get('trang-thai'));
}

async function refreshAccount(force=false) {
  const profile=state.session?.profile;
  if (!onAccount||!profile) return;
  if (onProfile) {renderAccount();return;}
  const request=++accountRequest;
  const hasReputation=profile.verified&&(path==='/tai-khoan'||path==='/tai-khoan/danh-gia');
  const dashboard=api('/api/dashboard');
  const reputation=hasReputation?api('/api/sellers/'+encodeURIComponent(profile.id)):null;
  let data;
  try {
    const [activity,ratings]=await Promise.all([dashboard,reputation]);
    data={...activity,reputation:ratings};
  } catch (error) {data={error:error.message};}
  if (request!==accountRequest) return;
  if (!force&&JSON.stringify(data)===JSON.stringify(accountData)) return;
  accountData=data;
  renderAccount();
}

function cartEntries() {
  const items=new Map(state.items.filter(item=>item.sellerId!==state.session?.profile?.id).map(item=>[item.id,item]));
  return [...cart].map(id=>({id,item:items.get(id)}));
}

function selectedCart(entries=cartEntries()) {
  return entries.filter(({id,item})=>item&&cartSelection.has(id)).map(({item})=>item);
}

function syncCartSelection() {
  const all=$('#cart-all');
  if (!all) return;
  const entries=cartEntries().filter(({item})=>item);
  const selected=selectedCart(entries);
  const eligible=new Set(entries.map(({id})=>id));
  const requests=selected.filter(item=>!item.sample).length;
  all.checked=eligible.size>0&&selected.length===eligible.size;
  all.indeterminate=selected.length>0&&!all.checked;
  all.disabled=cartSending||!eligible.size;
  for (const checkbox of main.querySelectorAll('[name=cart-item]')) {
    checkbox.disabled=cartSending||!eligible.has(checkbox.value);
    checkbox.checked=eligible.has(checkbox.value)&&cartSelection.has(checkbox.value);
  }
  $('#cart-selection-label').textContent='Chọn tất cả ('+selected.length+' / '+eligible.size+')';
  $('#cart-selected-count').textContent=selected.length;
  $('#cart-subtotal').textContent=money(selected.reduce((total,item)=>total+effectivePrice(item),0));
  const submit=$('[data-action=cart-submit]');
  submit.disabled=cartSending||!requests;
  submit.textContent=cartSending?'Đang gửi…':requests?'Gửi '+requests+' đề nghị mua':'Gửi đề nghị mua';
  $('[data-action=cart-remove-selected]').disabled=cartSending||!selected.length;
  main.querySelectorAll('[data-action=cart-save],[data-action=cart-remove],[data-action=contact]').forEach(button=>{button.disabled=cartSending;});
}

function renderCart() {
  main.innerHTML=cartPage(cartEntries(),state.session?.profile,accountCounts(),cartSending);
  document.title='Giỏ hàng · RE:CLASS';
  syncCartSelection();
}

function updateCart(added=[],removed=[]) {
  removed.forEach(id=>{cart.delete(id);cartSelection.delete(id);});
  added.forEach(id=>{cart.add(id);cartSelection.add(id);});
  storeList(cartKey,[...cart]);
  updateHeader();
  if (onCart) renderCart();
}

async function sendCart() {
  const requests=selectedCart().filter(item=>!item.sample);
  if (cartSending||!requests.length||!workflow.profileRequired(true)) return;
  cartSending=true;
  syncCartSelection();
  try {
    const results=await Promise.allSettled(requests.map(item=>api('/api/trades',{listingId:item.id})));
    const sent=requests.filter((_,index)=>results[index].status==='fulfilled');
    const errors=results.filter(result=>result.status==='rejected');
    if (sent.length) updateCart([],sent.map(item=>item.id));
    if (!errors.length) {location.assign('/tai-khoan/don-mua');return;}
    notify((sent.length?'Đã gửi '+sent.length+' đề nghị. ':'')+
      'Còn '+errors.length+' món chưa gửi: '+errors[0].reason.message);
  } finally {
    cartSending=false;
    syncCartSelection();
  }
}

function render() {
  if (onAuth) {
    document.title=(path==='/dang-ky'?'Tạo tài khoản':'Đăng nhập')+' · RE:CLASS';
    if (!$('.auth-layout')) main.innerHTML=authPage(path==='/dang-ky');
  } else if (onAccount) renderAccount();
  else if (onCart) renderCart();
  else if (path==='/') {
    const byId=new Map(state.items.map(item=>[item.id,item]));
    const recent=readList(viewKey).map(id=>byId.get(id)).filter(Boolean).slice(0,4);
    main.innerHTML=home(state.items,saved,state.featured,recent);
  } else if (onCatalog) {
    main.innerHTML=catalog(filters);
    for (const field of ['sort','condition']) $('#'+field).value=filters[field];
    renderCatalog();
  } else if (product) {
    const item=state.detail?.item||sampleListings.find(item=>item.id===product);
    const seller=state.detail?.seller||shopFixture(item?.sellerId);
    if (item&&seller) {
      const focusedTab=document.activeElement?.getAttribute('role')==='tab';
      document.title=item.title+' · RE:CLASS';
      main.innerHTML=detail(item,seller,seller.reviews,relatedTo(item),saved,seller.listings.length,state.session?.profile,cart.has(item.id));
      applyTab(state.tab,focusedTab);
      applyPhoto(item,Math.min(state.photo,item.images.length-1));
      storeList(viewKey,[item.id,...readList(viewKey).filter(id=>id!==item.id)].slice(0,12));
    } else main.innerHTML=state.ready?unavailable():pageLoading();
  } else if (shop) {
    const seller=state.seller||shopFixture(shop);
    if (seller) {
      document.title=seller.shop+' · RE:CLASS';
      main.innerHTML=storefront(seller,saved,seller.id===state.session?.profile?.id,params.get('xem'));
    } else main.innerHTML=state.ready?unavailable():pageLoading();
  } else main.innerHTML=unavailable();
}
async function refresh(marketOnly=false) {
  const number=++refreshNumber;
  const requests=[marketOnly?state.session:api('/api/session'),api('/api/listings')];
  if (product) requests.push(api('/api/listings/'+encodeURIComponent(product)));
  else if (shop) requests.push(api('/api/sellers/'+encodeURIComponent(shop)));
  const [session,items,page]=await Promise.allSettled(requests);
  let syncedSaved;
  if (!marketOnly&&session.status==='fulfilled') {
    if (session.value.signed) syncedSaved=await api('/api/saved').catch(()=>undefined);
    else syncedSaved=readList(savedKey);
  }
  if (number!==refreshNumber) return;
  if (!marketOnly&&session.status==='fulfilled') state.session=session.value;
  if (syncedSaved) saved=new Set(syncedSaved);
  let changed=!state.ready||!marketOnly;
  if (items.status==='fulfilled'&&JSON.stringify(items.value)!==JSON.stringify(state.items)) {
    state.items=items.value;
    state.index=indexListings(state.items);
    populateSchools(school.value);
    changed=true;
  }
  if (page) {
    const key=product?'detail':'seller';
    if (page.status==='fulfilled'||page.reason?.status===404) {
      const next=page.status==='fulfilled'?page.value:null;
      if (JSON.stringify(next)!==JSON.stringify(state[key])) {state[key]=next;changed=true;}
    }
  }
  state.ready=true;
  scheduleOffers();
  updateHeader();
  if (!changed) return;
  if (onAuth&&state.session?.signed) {
    location.replace(params.get('tiep')==='/gio-hang'?'/gio-hang':'/tai-khoan');
    return;
  }
  if (onAccount&&marketOnly) {
    if (!onProfile) await refreshAccount();
  } else if (onCatalog&&$('#catalog-list')) renderCatalog();
  else render();
  if (onAccount&&!onProfile&&!marketOnly) await refreshAccount();
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
async function save(id,keep=!saved.has(id)) {
  if (saving.has(id)) return false;
  if (keep===saved.has(id)) return true;
  if (state.session?.signed) {
    saving.add(id);
    try {await api('/api/saved/'+encodeURIComponent(id),{saved:keep});}
    finally {saving.delete(id);}
  }
  if (keep) saved.add(id); else saved.delete(id);
  if (!state.session?.signed) storeList(savedKey,[...saved]);
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
  return true;
}
async function share() {
  try {
    if (navigator.share) await navigator.share({title:document.title,url:location.href});
    else { await navigator.clipboard.writeText(location.href);notify('Đã sao chép đường dẫn.'); }
  }catch(error){if(error.name!=='AbortError') workflow.showLink(location.href);}
}
function scheduleOffers() {
  clearTimeout(offerTimeout);
  if (!(onCatalog||product||shop||path==='/'||onCart)) return;
  const now=Date.now();
  const next=state.items.reduce((soonest,item)=>Math.min(soonest,activeOffer(item,now)?.endsAt??Infinity),Infinity);
  if (!Number.isFinite(next)) return;
  offerTimeout=setTimeout(()=>{
    if (onCatalog) {
      renderCatalog();
      autocomplete.update(suggestionPool(availableIndex()));
    } else render();
    scheduleOffers();
  },Math.min(next-now,2_147_483_647));
}

function updateCountdown() {
  const timer=$('[data-sale-ends]');
  if(timer) timer.textContent=countdown(Number(timer.dataset.saleEnds));
}

function applyPrice(min,max) {
  const form=$('#price-filter-form');
  filters.minPrice=min;
  filters.maxPrice=max;
  form.elements.min.value=min;
  form.elements.max.value=max;
  form.querySelector('.form-error').hidden=true;
  form.closest('details').open=false;
  filterChanged();
  $('#price-filter-summary').focus({preventScroll:true});
}
document.addEventListener('submit',event=>{
  const form=event.target;
  if (form.id!=='price-filter-form') return;
  event.preventDefault();
  const min=priceLimit(form.elements.min.value);
  const max=priceLimit(form.elements.max.value);
  const err=form.querySelector('.form-error');
  if ([form.elements.min,form.elements.max].some(field=>field.validity.badInput||(field.value!==''&&!priceLimit(field.value)))) {
    err.textContent='Nhập số nguyên từ 0 đến 20.000.000đ.';
  } else if (min&&max&&Number(min)>Number(max)) {
    err.textContent='Giá tối đa cần bằng hoặc lớn hơn giá tối thiểu.';
  } else return applyPrice(min,max);
  err.hidden=false;
});

function clearFilters() {
  clearTimeout(searchTimer);
  for (const key of ['category','tag','query','condition','minPrice','maxPrice','sort']) filters[key]='';
  filters.sale=false;
  search.value='';
  school.value='';
  for (const field of ['sort','condition']) $('#'+field).value='';
  const priceForm=$('#price-filter-form');
  priceForm.elements.min.value='';
  priceForm.elements.max.value='';
  priceForm.querySelector('.form-error').hidden=true;
  filterChanged();
  $('#catalog-pills button').focus();
}

school.addEventListener('change',()=>{
  if (onCatalog) filterChanged();
  else autocomplete.update(suggestionPool(availableIndex()));
});
document.addEventListener('change',event=>{
  const {id,value,name,checked}=event.target;
  if (onCart&&(id==='cart-all'||name==='cart-item')) {
    const changed=id==='cart-all'?cartEntries().filter(({item})=>item).map(({id})=>id):[value];
    changed.forEach(id=>{if (checked) cartSelection.add(id); else cartSelection.delete(id);});
    syncCartSelection();
    return;
  }
  if (!onCatalog||!['sort','condition'].includes(id)) return;
  filters[id]=value;
  filterChanged();
});
document.addEventListener('keydown',event=>{
  if (event.key==='Escape') {
    const disclosure=event.target.closest?.('.tag-more[open],.price-filter[open]');
    if (disclosure) {event.preventDefault();disclosure.open=false;disclosure.querySelector('summary').focus();return;}
  }
  if (event.target.getAttribute?.('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  const tabs=[...document.querySelectorAll('[role=tab]')];
  const i=tabs.indexOf(event.target);
  const next={Home:0,End:tabs.length-1,ArrowLeft:(i+tabs.length-1)%tabs.length,ArrowRight:(i+1)%tabs.length}[event.key];
  event.preventDefault();
  switchTab(tabs[next].dataset.id,true);
});
document.addEventListener('click',async event=>{
  if (!event.target.closest('.tag-more')) document.querySelectorAll('.tag-more[open]').forEach(tags=>{tags.open=false;});
  if (!event.target.closest('.price-filter')&&$('.price-filter[open]')) $('.price-filter').open=false;
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
      if (!button.isConnected) {
        const selected=filters.tag&&$('#catalog-tags [aria-pressed=true]');
        (selected||$('#catalog-tags summary'))?.focus({preventScroll:true});
      }
    } else if (action==='sale-filter') {
      filters.sale=!filters.sale;
      filterChanged();
    } else if (action==='clear-price') applyPrice('','');
    else if (action==='clear-filters') clearFilters();
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
    } else if (action==='cart-add') {
      if (cart.has(id)) {location.assign('/gio-hang');return;}
      updateCart([id]);
      notify('Đã thêm món đồ vào giỏ hàng.');
    } else if (action==='cart-remove') updateCart([],[id]);
    else if (action==='cart-remove-selected') updateCart([],selectedCart().map(item=>item.id));
    else if (action==='cart-save') {
      if (await save(id,true)) {updateCart([],[id]);notify('Đã chuyển món đồ sang tin đã lưu.');}
    } else if (action==='cart-submit') await sendCart();
    else if (action==='reload-account') await refreshAccount(true);
    else if (action==='save') await save(id);
    else if (action==='share') await share();
    else if (action==='tab') switchTab(id);
    else if (action==='photo') await choosePhoto(Number(id));
    else if (action==='contact'&&((state.detail?.item||sampleListings.find(item=>item.id===id))?.sample)) {
      workflow.showSample();
    } else await workflow.handle(action,id,button);
  }catch(error){notify(error.message);}
});
window.addEventListener('storage',event=>{
  if (event.key!==cartKey&&event.key!==null) return;
  const next=new Set(readList(cartKey));
  for (const id of next) if (!cart.has(id)) cartSelection.add(id);
  for (const id of cartSelection) if (!next.has(id)) cartSelection.delete(id);
  cart=next;
  updateHeader();
  if (onCart) renderCart();
});
window.addEventListener('pageshow',event=>{
  document.documentElement.classList.remove('is-navigating');
  if (event.persisted) {
    refresh();
  }
});

$('.search-icon').innerHTML=icon('search');
$('.cart-icon').innerHTML=icon('cart');
$('.account-icon').innerHTML=icon('account');
$('.inbox-icon').innerHTML=icon('inbox');
for (const button of document.querySelectorAll('[data-theme-choice]')) button.innerHTML=icon(button.dataset.themeChoice==='dark'?'moon':'sun');
updateTheme(document.documentElement.dataset.theme);
$('#footer').innerHTML=footer();
search.value=filters.query;
populateSchools(params.get('truong'));
autocomplete.update(suggestionPool(availableIndex()));
updateHeader();
render();
scheduleOffers();
if (product) setInterval(updateCountdown,1000);
refresh().then(()=>{
  const anchor=location.hash.slice(1);
  if(anchor) document.getElementById(anchor)?.scrollIntoView({behavior:'instant'});
  const updates=new EventSource('/api/listings/events');
  if (onAccount&&!onProfile&&state.session?.signed) {
    const inboxUpdates=new EventSource('/api/inbox/events');
    inboxUpdates.addEventListener('change',()=>refreshAccount());
  }
  let pending=false, changed=false;
  updates.addEventListener('change',async()=>{
    changed=true;
    if (pending) return;
    pending=true;
    try {while (changed) {changed=false;await refresh(true);}}
    finally {pending=false;}
  });
});
