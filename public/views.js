
import { categories, sampleReviews } from './data.js';

export const $ = selector => document.querySelector(selector);
export const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const money = value => Number(value).toLocaleString('vi-VN') + 'đ';
export const categoryName = id => categories.find(category => category.id === id)?.name ?? 'Đồ học đường';
export const productPath = id => '/san-pham/' + encodeURIComponent(id);
export const sellerPath = id => '/gian-hang/' + encodeURIComponent(id);
export const browsePath = (category='', query='') => '/kham-pha' + (category || query ? '?' + new URLSearchParams({...(category && {danhmuc:category}),...(query && {q:query})}) : '');

const paths={
 search:'<circle cx="10.7" cy="10.7" r="6.1"/><path d="m16 16 4 4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/>',
 moon:'<path d="M20.9 15A9 9 0 0 1 9 3a8.9 8.9 0 1 0 11.9 12Z"/>',
 heart:'<path d="M20.8 8.4c0 4.3-8.8 9.7-8.8 9.7S3.2 12.7 3.2 8.4a4.4 4.4 0 0 1 8.8-.6 4.4 4.4 0 0 1 8.8.6Z"/>',
 check:'<path d="m5 12 4 4 10-10"/>',
 left:'<path d="m14 6-6 6 6 6"/>',
 right:'<path d="m10 6 6 6-6 6"/>',
 group:'<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6m5 8v-2a4 4 0 0 0-3-4"/>',
 shield:'<path d="M12 22c5-2 8-5 8-10V5l-8-3-8 3v7c0 5 3 8 8 10Z"/><path d="m8 12 3 3 5-6"/>',
 leaf:'<path d="M3 21 16 8m5-5C7 1 3 10 5 15c3 5 16 4 16-12Z"/>',
 flag:'<path d="M5 22V4m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
 share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.5 6.6-4m-6.6 7 6.6 4"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
export const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';

const verified = person => person.verified ? '<span class="verified">' + icon('check') + ' Học sinh đã xác minh</span>' : '';
const avatar = person => '<span class="avatar" aria-hidden="true">' + html(person.name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase()) + '</span>';
const stars = rating => '<span class="stars" aria-label="' + html(rating) + ' trên 5 sao">' + '★'.repeat(Math.round(Number(rating)||0)) + '</span>';
const date = value => value ? new Date(value+'Z').toLocaleDateString('vi-VN') : '';
const sampleTag = listing => listing.sample ? 'Tin mẫu' : date(listing.created);
const empty = (title,description='') => '<div class="empty"><strong>' + title + '</strong>' + (description ? '<p>' + description + '</p>' : '') + '</div>';

export function listingCards(items, saved) {
  if (!items.length) return empty('Chưa tìm thấy món đồ nào.', 'Thử đổi từ khóa, danh mục hoặc trường học.');
  return '<div class="listing-grid">'+items.map(item=>`
    <article class="listing">
      <div class="listing-visual">
        <a href="${productPath(item.id)}" aria-label="${html(item.title)}"><img src="${html(item.images[0])}" alt="${html(item.title)}" loading="lazy"></a>
        <span class="badge">${html(item.condition)}</span>
        <button class="heart" data-action="save" data-id="${html(item.id)}" type="button" aria-label="Lưu ${html(item.title)}" aria-pressed="${saved.has(item.id)}">${icon('heart')}</button>
      </div>
      <h3><a href="${productPath(item.id)}">${html(item.title)}</a></h3>
      <p class="price">${money(item.price)}</p>
      <p class="school">${html(item.school)}</p>
      <div class="listing-meta">${verified(item)}<span>${html(sampleTag(item))}</span></div>
    </article>`).join('')+'</div>';
}

export function pills(current, kind) {
  return '<div class="pills" role="group" aria-label="Danh mục">' + [{id:'',short:kind==='featured'?'Dành cho bạn':'Tất cả'},...categories].map(cat=>`
    <button class="pill" data-action="${kind}" data-id="${cat.id}" aria-pressed="${current===cat.id}">${cat.short}</button>`).join('')+'</div>';
}

export function footer() {
  return `<div class="wrap">
    <div class="footer-grid">
      <div><a class="brand" href="/"><strong>RE:CLASS</strong></a><p>Buy smarter. Reuse better.<br>Trade within your school community.</p></div>
      <div><h3>Khám phá</h3>${categories.slice(0,4).map(cat=>'<a href="'+browsePath(cat.id)+'">'+cat.name+'</a>').join('')}</div>
      <div><h3>Về RE:CLASS</h3><a href="/#ve-chung-toi">Câu chuyện của chúng mình</a><a href="/#cach-hoat-dong">Cách hoạt động</a><button class="bare" data-action="rules">Quy chuẩn tin đăng</button><button class="bare" data-action="account">Gian hàng của mình</button></div>
      <div><h3>Hỗ trợ & an toàn</h3><button class="bare" data-action="safety">Hướng dẫn giao dịch</button><button class="bare" data-action="report-site">Báo cáo vi phạm</button><button class="bare" data-action="privacy">Quyền riêng tư</button><button class="bare" data-action="rules">Điều khoản sử dụng thử</button></div>
    </div>
    <div class="footer-bottom"><span>© ${new Date().getFullYear()} RE:CLASS · Cộng đồng học sinh THPT</span><span>Một dự án học sinh về tái sử dụng đồ học đường.</span></div>
  </div>`;
}

const steps=[
 'Xác minh học sinh|Tham gia bằng tư cách học sinh THPT của bạn.',
 'Tìm hoặc đăng đồ|Ảnh thật, mô tả rõ. Tin đăng được kiểm duyệt.',
 'Kết nối & trao đổi|Nhắn tin, hẹn nhận đồ tại nơi phù hợp.',
 'Xác nhận & đánh giá|Uy tín đến từ giao dịch được hai bên xác nhận.'
];

export function home(items, saved, featured) {
  const sampleFeatured=items.filter(item=>!featured || item.category===featured).slice(0,4);
  return `
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">Đồ cũ, hành trình mới.</p>
        <h1>Đồ bạn từng quý,<br>đi tiếp cùng ai đó.</h1>
        <p class="hero-lede">Góc trao đổi đồ học đường của học sinh THPT.<br>Tìm đúng món cần, pass lại món thương trong cộng đồng của bạn.</p>
        <div class="hero-buttons"><a class="button primary" href="/kham-pha">Khám phá ngay</a><button class="button secondary" data-action="post">Mình có đồ muốn pass</button></div>
        <p class="hero-note">${icon('check')} Học sinh xác minh <span aria-hidden="true">·</span> Tin đăng được kiểm duyệt</p>
      </div>
      <div class="hero-art"><img src="/assets/hero.jpg" alt="Sách cũ, máy tính, sổ tay và hộp bút trên bàn gỗ bên cửa sổ" fetchpriority="high"><div class="sticky-note">Cũ với bạn,<br>Mới với mình.</div></div>
    </div>
  </section>
  <section class="section" id="danh-muc"><div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Góc nhỏ, đồ dùng hay</p><h2>Hôm nay bạn cần gì?</h2></div><div class="carousel-controls"><button class="button subtle icon-button" data-action="category-scroll" data-id="-1" aria-label="Danh mục trước">${icon('left')}</button><button class="button dark icon-button" data-action="category-scroll" data-id="1" aria-label="Danh mục tiếp theo">${icon('right')}</button></div></div>
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

export function catalog(items, saved, filters) {
  return `<section class="section wrap"><div class="section-head"><div><p class="eyebrow">Chợ đồ học đường</p><h1>${filters.saved ? 'Tin đã lưu' : 'Khám phá'}</h1><p id="catalog-count">${catalogCount(items,filters.query)}</p></div>${filters.saved?'':'<a class="button secondary" href="/da-luu">Tin đã lưu</a>'}</div>
    <div class="catalog-controls"><div id="catalog-pills">${pills(filters.category,'filter')}</div><select id="sort" aria-label="Sắp xếp"><option value="new">Mới nhất</option><option value="low">Giá thấp trước</option><option value="high">Giá cao trước</option></select></div>
    <div id="catalog-list">${listingCards(items,saved)}</div>
  </section>`;
}
export function catalogCount(items, query) { return items.length+' tin đăng'+(query?' cho “'+html(query)+'”':''); }

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
function reviewList(reviews) {
  if (!reviews.length) return '<p>Chưa có đánh giá từ giao dịch đã xác nhận.</p>';
  return '<ul class="review-list">'+reviews.map(review=>`<li>${stars(review.rating)}<p>${html(review.text)}</p><small>${html(review.author)} · ${review.id.startsWith('sample-')?'Đánh giá minh họa':'Giao dịch đã xác nhận'}</small>${!review.id.startsWith('sample-')?'<button class="bare report-review" data-action="report-review" data-id="'+html(review.id)+'">Báo cáo đánh giá</button>':''}</li>`).join('')+'</ul>';
}

export function detail(listing, seller, reviews, related, saved, open, signed) {
  const calc=listing.id==='may-tinh-khoa-hoc';
  const own=listing.sellerId===signed?.id;
  const available=listing.status==='active';
  const sold=listing.status==='sold';
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
      <div class="detail-price"><p class="price">${money(listing.price)}</p>${listing.negotiable||listing.sample?'<span class="badge">Có thương lượng</span>':''}</div>
      <dl class="specs"><dt>Tình trạng</dt><dd>${html(listing.condition)}${calc?' · Các phím hoạt động bình thường':''}</dd><dt>Khu vực</dt><dd>${html(listing.school)}</dd><dt>Giao nhận</dt><dd>Thỏa thuận trực tiếp với người bán</dd><dt>Đăng tin</dt><dd>${html(sampleTag(listing))}</dd></dl>
      <a class="seller-mini" href="${sellerPath(seller.id)}">${avatar(seller)}<span><strong>${html(seller.name)}</strong><small>${verified(seller)}</small></span>${seller.rating?'<span class="price">'+Number(seller.rating).toLocaleString('vi-VN',{maximumFractionDigits:1})+' ★</span>':''}</a>
      <div class="detail-actions"><button class="button primary" data-action="${own?'edit':'contact'}" data-id="${html(listing.id)}" ${sold||(!own&&!available)?'disabled':''}>${primaryText}</button><button class="button secondary save-detail" data-action="save" data-id="${html(listing.id)}" aria-pressed="${saved.has(listing.id)}">${icon('heart')} <span>${saved.has(listing.id)?'Đã lưu':'Lưu tin'}</span></button></div>
      <p class="small-note">Kiểm tra món đồ và thống nhất địa điểm gặp trước khi giao dịch.</p>
      <div class="detail-links">${available||sold?`<button class="bare" data-action="report" data-id="${html(listing.id)}">${icon('flag')} Báo cáo tin đăng</button>`:''}<button class="bare" data-action="share">${icon('share')} Chia sẻ</button></div>
    </div>
  </div></div>
  <section class="section detail-body"><div class="wrap detail-body-grid">
    <div><div class="tabs" role="tablist" aria-label="Thông tin sản phẩm"><button role="tab" id="tab-description" data-action="tab" data-id="description" aria-controls="panel-description" aria-selected="true">Mô tả sản phẩm</button><button role="tab" id="tab-delivery" data-action="tab" data-id="delivery" aria-controls="panel-delivery" aria-selected="false" tabindex="-1">Giao nhận</button><button role="tab" id="tab-reviews" data-action="tab" data-id="reviews" aria-controls="panel-reviews" aria-selected="false" tabindex="-1">Đánh giá người bán (${reviews.length})</button></div>
    <div class="tab-panel" role="tabpanel" id="panel-description" aria-labelledby="tab-description"><h2>${calc?'Vẫn tốt cho những bài toán tiếp theo.':'Thông tin món đồ'}</h2><p class="preserve-lines">${html(listing.description)}</p>
      ${calc?'<ul><li>Có vết xước nhẹ ở mặt sau do sử dụng.</li><li>Các phím bấm và màn hình hoạt động bình thường.</li><li>Bạn có thể kiểm tra máy trước khi nhận.</li></ul>':''}
      <div class="inline-box"><h3>Hẹn nhận thế nào?</h3><p class="preserve-lines">${html(listing.delivery)}</p></div>
      ${reviews.length?`<div class="recent-review"><h3>Gần đây từ người mua</h3>${reviewList(reviews.slice(0,1))}</div>`:''}
    </div>
    <div class="tab-panel" role="tabpanel" id="panel-delivery" aria-labelledby="tab-delivery" hidden><h2>Giao nhận</h2><p class="preserve-lines">${html(listing.delivery)}</p><p>Hai bên có thể hẹn tại nơi công cộng phù hợp và kiểm tra đồ khi nhận.</p></div>
    <div class="tab-panel" role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" hidden><h2>Đánh giá người bán</h2>${reviewList(reviews)}</div>
    </div>${sellerBox(seller,open)}
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
export function storefront(seller,listings,reviews,saved) {
  return `<section class="section wrap"><div class="profile-heading">${avatar(seller)}<div><p class="eyebrow">Gian hàng học đường</p><h1>${html(seller.shop)}</h1><p class="small-note">${html(seller.name)} · ${html(seller.school)} ${verified(seller)}</p></div></div>
    ${seller.bio?'<p>'+html(seller.bio)+'</p>':''}${stats(seller,listings.length)}${seller.sample?'<p class="small-note">Gian hàng và giao dịch minh họa.</p>':''}</section>
    <section class="section detail-body"><div class="wrap"><div class="section-head"><h2>Món đồ đang đăng</h2></div>${listingCards(listings,saved)}</div></section>
    <section class="section wrap"><h2>Đánh giá gần đây</h2>${reviewList(reviews)}</section>`;
}
export function unavailable() {return '<section class="section wrap"><h1>Không tìm thấy trang</h1><p class="hero-lede">Tin đăng có thể đã được ẩn hoặc đường dẫn đã thay đổi.</p><a class="button primary" href="/kham-pha">Khám phá chợ đồ học đường</a></section>';}

