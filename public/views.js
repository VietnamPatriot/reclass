
import { categories, sampleReviews } from './catalog/data.js';
import { tag, tagsFor } from './catalog/tags.js';
import { activeOffer, countdown, listingPriceLimit } from './catalog/offers.js';

export const $ = selector => document.querySelector(selector);
export const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const money = value => Number(value).toLocaleString('vi-VN') + 'đ';
export const categoryName = id => categories.find(category => category.id === id)?.name ?? 'Đồ học đường';
export const productPath = id => '/san-pham/' + encodeURIComponent(id);
export const sellerPath = id => '/gian-hang/' + encodeURIComponent(id);
export const browsePath = (category='', query='', label='') => {
  const params=new URLSearchParams();
  if (category) params.set('danhmuc',category);
  if (query) params.set('q',query);
  if (label) params.set('the',label);
  return '/kham-pha'+(params.size?'?'+params:'');
};

const paths={
 search:'<circle cx="10.7" cy="10.7" r="6.1"/><path d="m16 16 4 4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/>',
 moon:'<path d="M20.9 15A9 9 0 0 1 9 3a8.9 8.9 0 1 0 11.9 12Z"/>',
 heart:'<path d="M20.8 8.4c0 4.3-8.8 9.7-8.8 9.7S3.2 12.7 3.2 8.4a4.4 4.4 0 0 1 8.8-.6 4.4 4.4 0 0 1 8.8.6Z"/>',
 cart:'<path d="M2 3h2l2.5 12h12l2-8H5"/><circle cx="8" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
 check:'<path d="m5 12 4 4 10-10"/>',
 left:'<path d="m14 6-6 6 6 6"/>',
 right:'<path d="m10 6 6 6-6 6"/>',
 group:'<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6m5 8v-2a4 4 0 0 0-3-4"/>',
 shield:'<path d="M12 22c5-2 8-5 8-10V5l-8-3-8 3v7c0 5 3 8 8 10Z"/><path d="m8 12 3 3 5-6"/>',
 leaf:'<path d="M3 21 16 8m5-5C7 1 3 10 5 15c3 5 16 4 16-12Z"/>',
 flag:'<path d="M5 22V4m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
 share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
 account:'<circle cx="12" cy="8" r="3.3"/><path d="M5 21v-2.2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V21"/>',
 inbox:'<path d="M20 11a7.8 7.8 0 0 1-8 7.5H9l-5 2 1.5-4a7.2 7.2 0 0 1-1.5-4.5 7.8 7.8 0 0 1 8-7.5A7.8 7.8 0 0 1 20 11Z"/><path d="M9 11h6"/>'
};
export const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';

export const verified = person => person.verified ? '<span class="verified">' + icon('check') + ' Học sinh đã xác minh</span>' : '';
export const avatar = person => '<span class="avatar" aria-hidden="true">' + html(person.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase()) + '</span>';
export const stars = rating => '<span class="stars" aria-label="' + html(rating) + ' trên 5 sao">' + '★'.repeat(Math.max(0,Math.min(5,Math.round(Number(rating)||0)))) + '</span>';
export const date = value => value ? new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN') : '';
const sampleTag = listing => listing.sample ? 'Tin mẫu' : date(listing.created);
export const empty = (title,description='') => '<div class="empty"><strong>' + title + '</strong>' + (description ? '<p>' + description + '</p>' : '') + '</div>';

function listingTags(item, limit=1, disclose=false) {
  const labels=(item.tags||[]).map(tag).filter(Boolean);
  if (!labels.length) return '';
  const render=label=>'<a class="product-tag-pip" href="'+browsePath(item.category,'',label.id)+'">'+html(label.label)+'</a>';
  return '<div class="listing-tags" aria-label="Thẻ sản phẩm">'+labels.slice(0,limit).map(render).join('')+
    (disclose?moreTags(labels.slice(limit),render):'')+'</div>';
}

function sellerRating(rating,count=0) {
  const rated=count>0&&Number.isFinite(rating);
  const score=rated?rating.toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
  const label=rated?`${score} trên 5 sao từ ${count} lượt đánh giá người bán`:'Người bán chưa có đánh giá';
  return `<span class="seller-rating" role="img" aria-label="${label}" title="${label}"><span aria-hidden="true">${rated?'★':'☆'}</span><strong>${score}</strong><span class="rating-count">(${count})</span></span>`;
}

export function priceMarkup(item,offer=activeOffer(item)) {
  return `<span class="listing-price">${offer?'<del aria-label="Giá gốc '+money(item.price)+'">'+money(item.price)+'</del>':''}<strong class="price">${money(offer?.price??item.price)}</strong></span>`;
}

function discountBadge(offer) {
  return `<span class="sale-badge" aria-label="Giảm ${offer.discount}%">${offer.discount}% OFF</span>`;
}

function offerDetails(offer, sample) {
  const until=new Date(offer.endsAt);
  const dateLabel=until.toLocaleString('vi-VN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
  return `<div class="offer-details">${icon('clock')}<div><strong>${sample?'Ưu đãi minh họa':'Ưu đãi có thời hạn'}</strong><small>Kết thúc ${dateLabel} (giờ Việt Nam)</small></div><time datetime="${until.toISOString()}" data-sale-ends="${offer.endsAt}" role="timer" aria-label="Thời gian ưu đãi còn lại">${countdown(offer.endsAt)}</time></div>`;
}

export function listingCards(items, saved) {
  if (!items.length) return empty('Chưa tìm thấy món đồ nào.', 'Thử đổi từ khóa, danh mục hoặc trường học.');
  return '<div class="listing-grid">'+items.map(item=>{
    const offer=activeOffer(item);
    return `
    <article class="listing">
      <div class="listing-visual${offer?' on-sale':''}">
        <a href="${productPath(item.id)}" aria-label="${html(item.title)}"><img src="${html(item.images[0])}" alt="${html(item.title)}" loading="lazy"></a>
        <span class="badge">${item.status==='sold'?'Đã trao tay':html(item.condition)}</span>${offer?discountBadge(offer):''}
        ${item.status==='sold'?'':`<button class="heart" data-action="save" data-id="${html(item.id)}" type="button" aria-label="Lưu ${html(item.title)}" aria-pressed="${saved.has(item.id)}">${icon('heart')}</button>`}
      </div>
      <h3><a href="${productPath(item.id)}">${html(item.title)}</a></h3>
      ${priceMarkup(item,offer)}
      ${sellerRating(item.rating,item.ratingCount)}
      <p class="school">${html(item.school)}</p>
      <div class="listing-meta">${verified(item)}<span>${html(sampleTag(item))}</span></div>
      ${listingTags(item)}
    </article>`;
  }).join('')+'</div>';
}

export function pills(current, kind) {
  return '<div class="pills" role="group" aria-label="Danh mục">' + [{id:'',short:kind==='featured'?'Dành cho bạn':'Tất cả'},...categories].map(cat=>`
    <button class="pill" data-action="${kind}" data-id="${cat.id}" aria-pressed="${current===cat.id}">${cat.short}</button>`).join('')+'</div>';
}

export function footer() {
  return `<div class="wrap">
    <div class="footer-row">
      <a class="brand" href="/"><strong>RE:CLASS</strong></a>
      <div class="footer-links" aria-label="Hỗ trợ">
        <button class="bare" type="button" data-action="safety">Giao dịch an toàn</button>
        <button class="bare" type="button" data-action="rules">Quy chuẩn tin đăng</button>
        <button class="bare" type="button" data-action="privacy">Quyền riêng tư</button>
        <button class="bare" type="button" data-action="report-site">Báo cáo vi phạm</button>
      </div>
    </div>
    <p class="footer-credit">© ${new Date().getFullYear()} RE:CLASS · Cộng đồng trao đổi đồ học đường</p>
  </div>`;
}

const steps=[
 'Xác minh học sinh|Tham gia bằng tư cách học sinh THPT của bạn.',
 'Tìm hoặc đăng đồ|Ảnh thật, mô tả rõ. Tin đăng được kiểm duyệt.',
 'Kết nối & trao đổi|Nhắn tin, hẹn nhận đồ tại nơi phù hợp.',
 'Xác nhận & đánh giá|Uy tín đến từ giao dịch được hai bên xác nhận.'
];

export function home(items, saved, featured, recent=[]) {
  const sampleFeatured=items.filter(item=>!featured || item.category===featured).slice(0,4);
  return `
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">Đồ cũ, hành trình mới.</p>
        <h1>Đồ bạn từng quý,<br>đi tiếp cùng ai đó.</h1>
        <p class="hero-lede">Góc trao đổi đồ học đường của học sinh THPT.<br>Tìm đúng món cần, pass lại món thương — ngay trong cộng đồng của bạn.</p>
        <div class="hero-buttons"><a class="button primary" href="/kham-pha">Khám phá ngay</a></div>
        <p class="hero-note">${icon('check')} Học sinh xác minh <span aria-hidden="true">·</span> Tin đăng được kiểm duyệt</p>
      </div>
      <div class="hero-art"><img src="/assets/hero.jpg" alt="Sách cũ, máy tính, sổ tay và hộp bút trên bàn gỗ bên cửa sổ" fetchpriority="high"><div class="sticky-note">Cũ với bạn,<br>Mới với mình.</div></div>
    </div>
  </section>
  <section class="section" id="danh-muc"><div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Góc nhỏ, đủ điều hay</p><h2>Hôm nay bạn cần gì?</h2></div><div class="carousel-controls"><button class="button subtle icon-button" data-action="category-scroll" data-id="-1" aria-label="Danh mục trước">${icon('left')}</button><button class="button dark icon-button" data-action="category-scroll" data-id="1" aria-label="Danh mục tiếp theo">${icon('right')}</button></div></div>
    <div class="category-track">${categories.map(cat=>`<a class="category" href="${browsePath(cat.id)}"><img src="/assets/${cat.image}.jpg" alt="" loading="lazy"><strong>${cat.name}</strong><p>${cat.hint}</p></a>`).join('')}</div>
  </div></section>
  <section class="workflow" id="cach-hoat-dong"><div class="wrap">
    <div><p class="eyebrow">Chuyện trao tay đồ dùng</p><h2>Một món đồ.<br> Thêm một hành trình.</h2></div>
    ${steps.map((step,i)=>{const [title,copy]=step.split('|');return `<div><span class="step-index" aria-hidden="true">0${i+1}</span><h3>${title}</h3><p>${copy}</p></div>`;}).join('')}
  </div></section>
  <section class="section" id="noi-bat"><div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Món hay đang chờ bạn</p><h2>Pass lại một chút, vui thêm một chút.</h2></div><a class="button subtle" href="/kham-pha">Xem tất cả</a></div>
    <div id="featured-pills">${pills(featured,'featured')}</div><div id="featured-list">${listingCards(sampleFeatured,saved)}</div>
    <p class="small-note">Xem ảnh, tình trạng và thông tin người bán trước khi quyết định.</p>
  </div></section>
  ${recent.length?`<section class="section recent-listings"><div class="wrap"><div class="section-head"><h2>Đã xem gần đây</h2><button class="button quiet" data-action="clear-views">Xóa lịch sử</button></div>${listingCards(recent,saved)}</div></section>`:''}
  <section class="section why" id="ve-chung-toi"><div class="wrap why-grid">
    <div><p class="eyebrow">Những người yêu đồ cũ</p><h2>Cùng trường, cùng chất.<br>Cùng giữ những điều còn tốt.</h2><p class="hero-lede">RE:CLASS là dự án của một nhóm học sinh THPT. Chúng mình muốn những món đồ còn tốt tìm được người cần, để tiết kiệm hơn và kết nối thêm trong cộng đồng.</p><button class="button primary" data-action="about">Câu chuyện RE:CLASS</button></div>
    <ul class="why-list">
      <li>${icon('group')}<div><strong>Đúng cộng đồng</strong><p>Xác minh tư cách học sinh trước khi tham gia giao dịch.</p></div></li>
      <li>${icon('leaf')}<div><strong>Rõ ràng từ tin đăng</strong><p>Danh mục học đường, ảnh thật và mô tả tình trạng cụ thể.</p></div></li>
      <li>${icon('shield')}<div><strong>Uy tín có cơ sở</strong><p>Đánh giá gắn với giao dịch đã được xác nhận.</p></div></li>
    </ul>
  </div></section>
  <section class="section reviews-teaser"><div class="wrap">
    <div><p class="eyebrow">Lời nhắn từ bạn học</p><h2>Đồ được pass.<br>Niềm vui ở lại.</h2><p class="small-note">Trải nghiệm minh họa</p></div>
    ${[sampleReviews[1],sampleReviews[0],sampleReviews[2]].map(review=>`<article class="sample-review">${stars(review.rating)}<p>“${html(review.text)}”</p><strong>${html(review.author)}</strong><br><small>${html(review.label)}</small></article>`).join('')}
  </div></section>
  <section class="cta"><div class="wrap"><div><p class="eyebrow">Góc nhỏ cho một vòng đời dài hơn</p><h2>Đồ còn tốt. Đừng để nằm yên.</h2><p>Bắt đầu từ một món đồ, cùng xây cộng đồng học đường biết sẻ chia.</p></div><button class="button dark" data-action="post">Pass món đồ đầu tiên</button></div></section>`;
}

const featuredTags=['on-thi','may-tinh','ao-trang'];
export function moreTags(tags, render, nested=false) {
  if (!tags.length) return '';
  const size = tags.length >= 30 ? 29 : tags.length;
  return `<details class="tag-more${nested?' tag-more-next':''}"><summary class="product-tag-pip">+ Thêm</summary><div class="tag-popup">${tags.slice(0,size).map(render).join('')}${moreTags(tags.slice(size),render,true)}</div></details>`;
}
export function catalogTagFilters(category, current) {
  const tags=tagsFor(category);
  if (!tags.length) return '';
  const featured=category?tags.slice(0,3):featuredTags.map(tag);
  const selected=tags.find(item=>item.id===current);
  if (selected && !featured.includes(selected)) featured[featured.length-1]=selected;
  const render=label=>`<button type="button" class="product-tag-pip" data-action="tag-filter" data-id="${label.id}" aria-pressed="${current===label.id}">${html(label.label)}</button>`;
  return `<div class="catalog-tags" role="group" aria-label="Thẻ sản phẩm">${featured.map(render).join('')}${moreTags(tags.filter(item=>!featured.includes(item)),render)}</div>`;
}

export function priceFilterLabel(min,max) {
  if (min&&max) return money(min)+' – '+money(max);
  if (min) return 'Từ '+money(min);
  if (max) return 'Đến '+money(max);
  return 'Khoảng giá';
}

function priceFilter(filters) {
  return `<details class="price-filter">
    <summary id="price-filter-summary"><span>${priceFilterLabel(filters.minPrice,filters.maxPrice)}</span></summary>
    <form id="price-filter-form" class="price-filter-form" novalidate>
      <div class="price-filter-inputs"><label>Từ (đ)<input type="number" name="min" inputmode="numeric" min="0" max="${listingPriceLimit}" step="1" placeholder="0" value="${html(filters.minPrice)}"></label>
      <label>Đến (đ)<input type="number" name="max" inputmode="numeric" min="0" max="${listingPriceLimit}" step="1" placeholder="Không giới hạn" value="${html(filters.maxPrice)}"></label></div>
      <p class="form-error" role="alert" hidden></p>
      <div class="price-filter-actions"><button type="button" class="button quiet" data-action="clear-price">Xóa giá</button><button type="submit" class="button primary">Áp dụng</button></div>
    </form>
  </details>`;
}

export function catalog(filters) {
  return `<section class="section wrap"><div class="section-head"><div><p class="eyebrow">Chợ đồ học đường</p><h1>${filters.saved ? 'Tin đã lưu' : 'Khám phá'}</h1><p id="catalog-count" role="status" aria-atomic="true"></p></div>${filters.saved?'':'<a class="button secondary" href="/da-luu">Tin đã lưu</a>'}</div>
    <div class="catalog-controls">
      <div id="catalog-pills">${pills(filters.category,'filter')}</div>
      <div class="catalog-selects">
        <select id="condition" aria-label="Tình trạng"><option value="">Mọi tình trạng</option><option>Như mới</option><option>Còn tốt</option><option>Có ghi chú</option></select>
        ${priceFilter(filters)}
        <select id="sort" aria-label="Sắp xếp"><option value="">Phù hợp nhất</option><option value="new">Mới nhất</option><option value="low">Giá thấp trước</option><option value="high">Giá cao trước</option></select>
      </div>
    </div>
    <div class="catalog-filterbar"><div id="catalog-tags">${catalogTagFilters(filters.category,filters.tag)}</div><div class="filter-utilities"><button type="button" class="product-tag-pip sale-filter" data-action="sale-filter" aria-pressed="${filters.sale}">Đang giảm giá</button><button type="button" class="bare clear-filters" data-action="clear-filters" hidden>Xóa bộ lọc</button></div></div>
    <div id="catalog-list"></div>
    <div class="catalog-more"><button class="button secondary" data-action="load-more" hidden>Xem thêm</button></div>
  </section>`;
}
export function catalogCount(length, query) { return length+' tin đăng'+(query?' cho “'+query+'”':''); }

export function pageLoading() {
  return '<section class="section wrap loading-page" role="status"><span class="loading-spinner" aria-hidden="true"></span><span>Đang tải…</span></section>';
}

function sellerBox(seller, open) {
  return `<aside class="seller-box"><header>${avatar(seller)}<div><strong>${html(seller.shop)}</strong><div class="listing-meta">${verified(seller)}</div></div></header>
  <p class="small-note">${html(seller.name)}<br>${html(seller.school)}</p>
  ${stats(seller,open)}
  ${seller.bio ? '<p class="small-note">'+html(seller.bio)+'</p>':''}
  <a href="${sellerPath(seller.id)}" class="button subtle">Xem sản phẩm trong gian hàng</a>
  ${seller.sample?'<p class="small-note">Gian hàng và giao dịch minh họa.</p>':''}</aside>`;
}
function stats(seller, open) {
  return `<div class="stats"><div><strong>${seller.rating?Number(seller.rating).toLocaleString('vi-VN',{maximumFractionDigits:1})+' / 5':'—'}</strong>Điểm đánh giá</div><div><strong>${Number(seller.completed)||0}</strong>Giao dịch</div><div><strong>${Number(open)||0}</strong>Đang đăng</div></div>`;
}
export function reviewList(reviews) {
  if (!reviews.length) return '<p>Chưa có đánh giá từ giao dịch đã xác nhận.</p>';
  return '<ul class="review-list">'+reviews.map(review=>`<li>${stars(review.rating)}<p>${html(review.text)}</p><small>${html(review.author)} · ${review.id.startsWith('sample-')?'Đánh giá minh họa':'Giao dịch đã xác nhận'}</small>${!review.id.startsWith('sample-')?'<button class="bare report-review" data-action="report-review" data-id="'+html(review.id)+'">Báo cáo đánh giá</button>':''}</li>`).join('')+'</ul>';
}

export function detail(listing, seller, reviews, related, saved, open, signed, inCart=false) {
  const calc=listing.id==='may-tinh-khoa-hoc';
  const own=listing.sellerId===signed?.id;
  const available=listing.status==='active';
  const sold=listing.status==='sold';
  const offer=activeOffer(listing);
  const primaryText=sold?'Đã trao tay':own?'Chỉnh sửa tin':available?'Nhắn tin cho người bán':'Tin đang được xử lý';
  return `<div class="wrap">
  <div class="breadcrumb" aria-label="Đường dẫn"><a href="/">Trang chủ</a><span>/</span><a href="${browsePath(listing.category)}">${categoryName(listing.category)}</a><span>/</span><span>${html(listing.title)}</span></div>
  <div class="detail-main">
    <div><div class="detail-frame"><img id="detail-image" src="${html(listing.images[0])}" alt="${html(listing.title)}"><span class="photo-count" id="photo-count">1 / ${listing.images.length}</span></div>
      ${listing.images.length>1?`<div class="thumbs" aria-label="Ảnh sản phẩm">${listing.images.map((image,i)=>`<button type="button" data-action="photo" data-id="${i}" aria-label="Xem ảnh ${i+1}" aria-pressed="${i===0}"><img src="${html(image)}" alt=""></button>`).join('')}</div>`:''}
      <p class="small-note">${listing.sample?'Ảnh minh họa sản phẩm.':'Ảnh do người bán cung cấp.'}</p>
    </div>
    <div class="detail-info">
      <span class="badge">${html(listing.condition)}</span><p class="eyebrow">${categoryName(listing.category)}</p>
      <h1>${html(listing.title)}</h1><p>${calc?'Một người bạn đồng hành cho những giờ Toán, Lý và mùa ôn thi sắp tới.':html(listing.description.slice(0,145))}</p>
      <div class="detail-price">${priceMarkup(listing,offer)}${offer?discountBadge(offer):listing.negotiable||listing.sample?'<span class="badge">Có thương lượng</span>':''}</div>
      <dl class="specs"><dt>Tình trạng</dt><dd>${html(listing.condition)}${calc?' · Các phím hoạt động bình thường':''}</dd><dt>Khu vực</dt><dd>${html(listing.school)}</dd><dt>Giao nhận</dt><dd>Thỏa thuận trực tiếp với người bán</dd><dt>Đăng tin</dt><dd>${html(sampleTag(listing))}</dd></dl>
      ${listingTags(listing,2,true)}
      <a class="seller-mini" href="${sellerPath(seller.id)}">${avatar(seller)}<span><strong>${html(seller.name)}</strong><small>${verified(seller)}</small></span>${sellerRating(seller.rating,reviews.length)}</a>
      <div class="detail-actions"><button class="button primary" data-action="${own?'edit':'contact'}" data-id="${html(listing.id)}" ${sold||(!own&&!available)?'disabled':''}>${primaryText}</button><button class="button secondary save-detail" data-action="save" data-id="${html(listing.id)}" aria-pressed="${saved.has(listing.id)}">${icon('heart')} <span>${saved.has(listing.id)?'Đã lưu':'Lưu tin'}</span></button></div>
      <p class="small-note">Kiểm tra món đồ và thống nhất địa điểm gặp trước khi giao dịch.</p>
      <div class="detail-links">${available&&!own?`<button class="bare" type="button" data-action="cart-add" data-id="${html(listing.id)}" data-in-cart="${inCart}">${icon('cart')} <span>${inCart?'Xem giỏ hàng':'Thêm vào giỏ'}</span></button>`:''}${available||sold?`<button class="bare" data-action="report" data-id="${html(listing.id)}">${icon('flag')} Báo cáo tin đăng</button>`:''}<button class="bare" data-action="share">${icon('share')} Chia sẻ</button></div>
    </div>
  </div></div>
  <section class="section detail-body"><div class="wrap detail-body-grid">
    <div><div class="tabs" role="tablist" aria-label="Thông tin sản phẩm"><button role="tab" id="tab-description" data-action="tab" data-id="description" aria-controls="panel-description" aria-selected="true">Mô tả sản phẩm</button><button role="tab" id="tab-delivery" data-action="tab" data-id="delivery" aria-controls="panel-delivery" aria-selected="false" tabindex="-1">Giao nhận</button><button role="tab" id="tab-reviews" data-action="tab" data-id="reviews" aria-controls="panel-reviews" aria-selected="false" tabindex="-1">Đánh giá người bán (${reviews.length})</button></div>
    <div class="tab-stage">
    <div class="tab-loader" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="tab-panel" role="tabpanel" id="panel-description" aria-labelledby="tab-description" tabindex="0"><h2>${calc?'Vẫn tốt cho những bài toán tiếp theo.':'Thông tin món đồ'}</h2><p class="preserve-lines">${html(listing.description)}</p>
      ${offer?offerDetails(offer,listing.sample):''}
      ${calc?'<ul><li>Có vết xước nhẹ ở mặt sau do sử dụng.</li><li>Các phím bấm và màn hình hoạt động bình thường.</li><li>Bạn có thể kiểm tra máy trước khi nhận.</li></ul>':''}
      <div class="inline-box"><h3>Hẹn nhận thế nào?</h3><p class="preserve-lines">${html(listing.delivery)}</p></div>
      ${reviews.length?`<div class="recent-review"><h3>Gần đây từ người mua</h3>${reviewList(reviews.slice(0,1))}</div>`:''}
    </div>
    <div class="tab-panel" role="tabpanel" id="panel-delivery" aria-labelledby="tab-delivery" tabindex="0" hidden><h2>Giao nhận</h2><p class="preserve-lines">${html(listing.delivery)}</p><p>Hai bên có thể hẹn tại nơi công cộng phù hợp và kiểm tra đồ khi nhận.</p></div>
    <div class="tab-panel" role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" tabindex="0" hidden><h2>Đánh giá người bán</h2>${reviewList(reviews)}</div>
    </div></div>${sellerBox(seller,open)}
  </div></section>
  ${safetyBand()}
  <section class="section"><div class="wrap"><div class="section-head"><h2>Có thể bạn cũng cần</h2><a class="button quiet" href="/kham-pha">Khám phá thêm</a></div>${listingCards(related,saved)}</div></section>`;
}

export function safetyBand() {
  return `<section class="safety"><div class="wrap"><div><p class="eyebrow">Trao đổi đồ học đường</p><h2>Cẩn thận một chút,<br>yên tâm hơn nhiều.</h2></div>
  <div><h3>Kiểm tra trước khi nhận</h3><p>Xem ảnh và mô tả. Kiểm tra món đồ khi gặp người bán.</p></div>
  <div><h3>Bảo vệ thông tin cá nhân</h3><p>Giữ riêng địa chỉ nhà, lịch học, giấy tờ và mã học sinh.</p></div>
  <div><h3>Chủ động báo cáo</h3><p>Dùng nút báo cáo nếu thấy tin đăng hoặc hành vi có vấn đề.</p></div></div></section>`;
}
export function storefront(seller,saved,own,requestedTab) {
  const {listings,reviews,soldListings=[]}=seller;
  const url=sellerPath(seller.id);
  const active=['da-ban','danh-gia'].includes(requestedTab)?requestedTab:'';
  return `<div class="wrap account-wrap">
    <div class="breadcrumb" aria-label="Đường dẫn"><a href="/">Trang chủ</a><span>/</span><a href="/kham-pha">Khám phá</a><span>/</span><span>Gian hàng</span></div>
    <div class="account-layout storefront">
      <aside class="account-sidebar"><div class="account-identity">${avatar(seller)}<h2>${html(seller.name)}</h2>${verified(seller)}<p>${html(seller.school)}</p>${seller.bio?'<p class="preserve-lines">'+html(seller.bio)+'</p>':''}</div>
      <div class="account-panel">${stats(seller,listings.length)}${seller.sample?'<p class="small-note">Gian hàng minh họa</p>':''}</div>
      <div class="account-tip"><h2>Hẹn gặp, trao tận tay.</h2><p>Ưu tiên trao đổi qua RE:CLASS và giao nhận ở nơi công cộng.</p></div></aside>
      <div class="account-content">
        ${own?'<div class="account-notice"><p>Đây là cách mọi người nhìn thấy hồ sơ của bạn.</p><a class="button secondary" href="/tai-khoan/ho-so">Chỉnh sửa hồ sơ</a></div>':''}
        <div class="account-heading"><div><p class="eyebrow">Gian hàng học đường</p><h1>${html(seller.shop)}</h1><p>Những món đồ còn nhiều câu chuyện.</p></div></div>
        <nav class="account-tabs" aria-label="Gian hàng">
          ${[['','Đang bán',listings.length],['da-ban','Đã bán',soldListings.length],['danh-gia','Đánh giá',reviews.length]]
            .map(([tab,label,count])=>`<a href="${url}${tab?'?xem='+tab:''}" ${active===tab?'aria-current="page"':''}>${label} · ${count}</a>`).join('')}
        </nav>
        ${active==='danh-gia'?'<section class="account-panel"><h2>Đánh giá người bán</h2>'+reviewList(reviews)+'</section>'
          :active==='da-ban'?(soldListings.length?listingCards(soldListings,saved):empty('Chưa có món đồ đã trao tay.')):listingCards(listings,saved)}
      </div>
    </div></div>`;
}
export function unavailable() {return '<section class="section wrap"><h1>Không tìm thấy trang</h1><p class="hero-lede">Tin đăng có thể đã được ẩn hoặc đường dẫn đã thay đổi.</p><a class="button primary" href="/kham-pha">Khám phá chợ đồ học đường</a></section>';}

