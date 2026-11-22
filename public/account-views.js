import { avatar, date, empty, html, icon, money, priceMarkup, productPath, reviewList, sellerPath, stars, verified } from './views.js';
import { button, editProfileForm, loginForm, registrationForm, statusNames } from './workflows.js';

const accountPath='/tai-khoan';
const purchases=accountPath+'/don-mua';
const sales=accountPath+'/don-ban';
const listingsPath=accountPath+'/tin-dang';
const profilePath=accountPath+'/ho-so';
const reviewsPath=accountPath+'/danh-gia';
const cartPath='/gio-hang';

const link=(label,href,style='subtle')=>`<a class="button ${style}" href="${href}">${label}</a>`;
const panel=(title,content)=>`<section class="account-panel"><h2>${title}</h2>${content}</section>`;
const heading=(label,title,description='',action='')=>`<header class="account-heading"><div><p class="eyebrow">${label}</p><h1>${title}</h1>${description?'<p>'+description+'</p>':''}</div>${action}</header>`;
const shortRating=value=>value==null?'—':Number(value).toLocaleString('vi-VN',{maximumFractionDigits:1})+' / 5';

export function authPage(register) {
  return `<section class="auth-page"><div class="wrap auth-layout">
    <div class="auth-story">
      <p class="eyebrow">Góc học trò · Hành trình mới</p>
      <h2>${register?'Thêm một người bạn.<br>Thêm nhiều điều hay.':'Gặp lại bạn,<br>vui như ngày tựu trường.'}</h2>
      <p>Chuyền tay món đồ còn tốt, giữ lại những điều đáng quý.</p>
      <img src="/assets/auth.jpg" alt="Balo xanh, chồng sách và dụng cụ học tập" fetchpriority="high">
      <p class="display">Cũ với bạn. Mới với mình.</p>
      <p>Một tài khoản để mua món cần, pass món thương.</p>
      <div class="auth-points"><span>${icon('check')} Cộng đồng THPT</span><span>${icon('check')} Trao đổi có trách nhiệm</span></div>
    </div>
    <div class="auth-card">
      <p class="eyebrow">${register?'Bắt đầu cùng RE:CLASS':'Chào mừng bạn trở lại'}</p>
      <h1>${register?'Tạo tài khoản':'Đăng nhập'}</h1>
      <p>${register?'Một góc nhỏ để những món đồ đi tiếp.':'Tiếp tục những cuộc hẹn và món đồ bạn yêu thích.'}</p>
      ${register?registrationForm():loginForm()}
      ${register?'<div class="account-notice"><div><strong>Xác minh email để bảo vệ tài khoản</strong><p>Sau khi đăng ký, hãy mở liên kết trong email.</p></div></div>':''}
      <p class="auth-switch">${register?'Đã có tài khoản? <a href="/dang-nhap">Đăng nhập</a>':'Chưa có tài khoản? <a href="/dang-ky">Đăng ký ngay</a>'}</p>
    </div>
  </div></section>`;
}

function sidebar(path,profile,counts) {
  const groups=[
    ['Tài khoản',[['Tổng quan',accountPath],['Thông tin cá nhân',profilePath]]],
    ['Góc người mua',[['Đơn mua',purchases],['Giỏ hàng',cartPath,counts.cart],['Đã lưu','/da-luu',counts.saved]]],
    ['Góc người bán',[['Quản lý tin đăng',listingsPath],['Đơn bán',sales]]],
    ['Cộng đồng',[['Đánh giá & uy tín',reviewsPath]]]
  ];
  return `<aside class="account-sidebar">
    <div class="account-identity">${avatar(profile)}<h2>${html(profile.name)}</h2>
      ${profile.verified?verified(profile):'<p class="account-unverified">Chưa xác minh học sinh</p>'}<p>${html(profile.school)}</p>
      ${profile.verified?`<a href="${sellerPath(profile.id)}">Xem hồ sơ công khai</a>`:button('Nhập mã xác minh','verify','','primary')}</div>
    <nav class="account-nav" aria-label="Tài khoản">${groups.map(([title,entries])=>`<div><p>${title}</p>${entries.map(([label,href,count])=>`<a href="${href}" ${path===href?'aria-current="page"':''}>${label}${count?`<span>${count}</span>`:''}</a>`).join('')}</div>`).join('')}</nav>
    <div class="account-tip"><h2>Chuyền đồ, giữ an tâm.</h2><p>Giữ riêng thông tin cá nhân. Ưu tiên gặp tại trường hoặc nơi công cộng.</p></div>
    <div class="account-tools">${button('Tin nhắn','inbox','','quiet')}${profile.moderator?button('Bảng kiểm duyệt','moderation','','quiet'):button('Quyền kiểm duyệt','claim','','quiet')}${button('Đăng xuất','sign-out','','quiet')}</div>
  </aside>`;
}

export function accountLayout(path,title,content,profile,counts) {
  return `<div class="wrap account-wrap">
    <div class="breadcrumb" aria-label="Đường dẫn"><a href="/">Trang chủ</a><span>/</span>${profile&&path!==accountPath?`<a href="${accountPath}">Tài khoản</a><span>/</span>`:''}<span>${title}</span></div>
    <div class="account-layout${profile?'':' account-guest'}">${profile?sidebar(path,profile,counts):''}<div class="account-content">${content}</div></div>
  </div>`;
}

function metrics(entries,filled=false) {
  return `<div class="account-metrics${filled?' metrics-filled':''}">${entries.map(([value,label,note])=>`<div><strong class="display">${value}</strong><p>${label}</p>${note?'<small>'+note+'</small>':''}</div>`).join('')}</div>`;
}

function tabs(entries,current,path) {
  return `<nav class="account-tabs" aria-label="Lọc theo trạng thái">${entries.map(([value,label])=>`<a href="${path}${value?'?trang-thai='+value:''}" ${value===current?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}

function tradeRows(trades,profile,items) {
  if (!trades.length) return empty('Chưa có giao dịch nào.', 'Các món đồ bạn trao đổi sẽ xuất hiện ở đây.');
  return `<div class="account-rows">${trades.map(trade=>{
    const buyer=trade.buyer_id===profile.id;
    const item=items.get(trade.listing_id);
    const confirmed=buyer?trade.buyer_done:trade.seller_done;
    const action=trade.status==='open'&&!confirmed?button(buyer?'Xác nhận đã nhận':'Xác nhận đã giao','trade-confirm',trade.id)
      :trade.status==='completed'&&buyer&&!trade.review_id?button('Viết đánh giá','trade',trade.id,'primary'):'';
    return `<article class="account-row account-panel">
      <div class="account-row-head"><strong>${html(buyer?trade.seller:trade.buyer)}</strong><span class="badge">${statusNames[trade.status]}</span></div>
      <div class="account-row-body">${item?'<img src="'+html(item.images[0])+'" alt="" loading="lazy">':''}<div>
        <h3><a href="${productPath(trade.listing_id)}">${html(trade.title)}</a></h3>
        <p>${date(trade.updated||trade.created)}${confirmed&&trade.status==='open'?' · Bạn đã xác nhận':''}</p></div></div>
      <div class="row-actions">${button(trade.status==='open'?'Mở tin nhắn':'Xem giao dịch','trade',trade.id,'subtle')}${action}</div>
      </article>`;
  }).join('')}</div>`;
}

function overview(profile,data,items,counts) {
  const {listings,trades,reputation}=data;
  const sold=trades.filter(trade=>trade.seller_id===profile.id&&trade.status==='completed').length;
  const bought=trades.filter(trade=>trade.buyer_id===profile.id&&trade.status==='completed').length;
  const active=listings.filter(item=>item.status==='active').length;
  const pending=listings.filter(item=>item.status==='pending').length;
  const open=trades.filter(trade=>trade.status==='open');
  const purchaseCount=open.filter(trade=>trade.buyer_id===profile.id).length;
  return heading('Tài khoản RE:CLASS','Chào '+html(profile.name)+', hôm nay có gì hay?','Mua món mình cần. Pass món mình thương.',button('Đăng tin miễn phí','post','','primary'))+
    metrics([[bought,'Món đã mua'],[sold,'Món đã pass'],[active,'Tin đang hiển thị',pending+' tin chờ duyệt'],[shortRating(reputation?.rating),'Điểm uy tín',(reputation?.reviews.length||0)+' lượt đánh giá']])+
    `<div class="account-corners">
      <section><p class="eyebrow">Tôi muốn tìm đồ</p><h2>Góc người mua</h2><p>${purchaseCount} giao dịch đang mở · ${counts.cart} món trong giỏ</p>${link('Xem đơn mua',purchases)}</section>
      <section><p class="eyebrow">Tôi có đồ muốn pass</p><h2>Góc người bán</h2><p>${active} tin hiển thị · ${pending} tin chờ duyệt · ${open.length-purchaseCount} giao dịch đang mở</p>${link('Quản lý tin đăng',listingsPath,'primary')}</section>
    </div>
    <section class="account-panel"><div class="account-row-head"><h2>Thông tin của bạn</h2>${link('Chỉnh sửa hồ sơ',profilePath)}</div>
      <dl class="account-facts"><div><dt>Tên hiển thị</dt><dd>${html(profile.name)}</dd></div><div><dt>Trường THPT</dt><dd>${html(profile.school)}</dd></div><div><dt>Tên gian hàng</dt><dd>${html(profile.shop)}</dd></div></dl></section>
    ${panel('Những lần trao tay gần đây',tradeRows(trades.slice(0,3),profile,items))}`;
}

function orders(path,profile,data,items,filter) {
  const selling=path===sales;
  const trades=data.trades.filter(trade=>trade[selling?'seller_id':'buyer_id']===profile.id);
  const statuses=['open','completed','cancelled'];
  const counts=statuses.map(status=>trades.filter(trade=>trade.status===status).length);
  const selected=statuses.includes(filter)?filter:'';
  return heading(selling?'Góc người bán':'Góc người mua',selling?'Đơn bán':'Đơn mua','Theo dõi trao đổi, hẹn giao nhận và xác nhận món đồ đã trao tay.')+
    metrics(statuses.map((status,i)=>[counts[i],statusNames[status]]),true)+
    tabs([['','Tất cả'],...statuses.map((status,i)=>[status,statusNames[status]+' · '+counts[i]])],selected,path)+
    tradeRows(trades.filter(trade=>!selected||trade.status===selected),profile,items);
}

function manageListings(listings,filter) {
  const statuses=['active','pending','rejected','sold','hidden'];
  const counts=statuses.map(status=>listings.filter(item=>item.status===status).length);
  const selected=statuses.includes(filter)?filter:'';
  const rows=listings.filter(item=>!selected||item.status===selected).map(item=>`<article class="account-row">
    <div class="account-row-body"><img src="${html(item.images[0])}" alt="" loading="lazy"><div>
    <h3><a href="${productPath(item.id)}">${html(item.title)}</a></h3><p class="price">${money(item.price)}</p><p>${date(item.created)}${item.reason?' · '+html(item.reason):''}</p></div></div>
    <div><span class="badge">${statusNames[item.status]}</span><div class="row-actions">
    ${item.status!=='sold'?button('Sửa tin','edit',item.id,'subtle'):''}
    ${['active','pending'].includes(item.status)?button('Ẩn tin','listing-hide',item.id,'subtle'):''}
    ${item.status==='hidden'?button('Gửi lại để duyệt','listing-submit',item.id,'subtle'):''}
    ${item.status==='rejected'?button('Gửi kháng nghị','appeal',item.id,'subtle'):''}</div></div>
    </article>`).join('');
  return heading('Góc người bán','Quản lý tin đăng','Theo dõi tin đang hiển thị và cập nhật những món đồ bạn muốn pass.',button('Đăng tin miễn phí','post','','primary'))+
    metrics([0,1,3].map(i=>[counts[i],statusNames[statuses[i]]]),true)+
    tabs([['','Tất cả'],...statuses.map((status,i)=>[status,statusNames[status]+' · '+counts[i]])],selected,listingsPath)+
    panel('Tin đăng của bạn',rows?'<div class="account-rows listing-rows">'+rows+'</div>':empty('Chưa có tin đăng ở trạng thái này.'));
}

function reputation(profile,data,items,filter) {
  const reviews=data.reputation?.reviews||[];
  const completed=data.trades.filter(trade=>trade.buyer_id===profile.id&&trade.status==='completed');
  const written=completed.filter(trade=>trade.review_id);
  const pending=completed.filter(trade=>!trade.review_id);
  const selected=['da-viet','cho-danh-gia'].includes(filter)?filter:'';
  return heading('Đánh giá & uy tín','Mỗi lần chuyền tay, thêm một niềm tin.','Bạn có thể đánh giá sau khi hai bên xác nhận giao dịch hoàn tất.')+
    `<div class="account-rating"><div><strong class="display">${shortRating(data.reputation?.rating)}</strong>${reviews.length?stars(data.reputation.rating):''}<p>${reviews.length} lượt đánh giá đã xác nhận</p></div>
    <div>${[5,4,3,2,1].map(value=>{const count=reviews.filter(row=>row.rating===value).length;
      return `<div class="rating-line"><span>${value} ★</span><meter min="0" max="${reviews.length||1}" value="${count}" aria-label="${value} sao, ${count} lượt"></meter><span>${count}</span></div>`;
    }).join('')}</div></div>`+
    tabs([['','Nhận được · '+reviews.length],['da-viet','Đã viết · '+written.length],['cho-danh-gia','Chờ đánh giá · '+pending.length]],selected,reviewsPath)+
    (selected?tradeRows(selected==='da-viet'?written:pending,profile,items):panel('Cộng đồng nói gì về bạn?',reviewList(reviews)));
}

export function accountPage(path,profile,data,items,counts,filter) {
  const labels={[accountPath]:'Tổng quan',[profilePath]:'Thông tin cá nhân',[purchases]:'Đơn mua',[sales]:'Đơn bán',[listingsPath]:'Quản lý tin đăng',[reviewsPath]:'Đánh giá & uy tín'};
  let content;
  if (path===profilePath) {
    content=heading('Tài khoản RE:CLASS','Chỉnh sửa hồ sơ','Tên hiển thị, tên gian hàng và lời giới thiệu giúp bạn kết nối với cộng đồng.')+
      panel('Hồ sơ học sinh',`<div class="profile-heading">${avatar(profile)}<div><strong>${html(profile.name)}</strong><p>${profile.verified?verified(profile):'Chưa xác minh học sinh'}</p></div></div>${editProfileForm(profile)}`)+
      `<div class="account-notice"><p>RE:CLASS giữ riêng ảnh giấy tờ và thông tin xác minh của bạn.</p>${button('Quyền riêng tư','privacy','','quiet')}</div>`;
  } else if (!data) {
    content=heading('Tài khoản RE:CLASS',labels[path])+'<p class="loading-page" role="status"><span class="loading-spinner" aria-hidden="true"></span>Đang tải…</p>';
  } else if (data.error) {
    content=heading('Tài khoản RE:CLASS',labels[path])+empty('Chưa tải được thông tin tài khoản.',html(data.error))+button('Thử lại','reload-account','','primary');
  } else if (path===listingsPath) content=manageListings(data.listings,filter);
  else if (path===purchases||path===sales) content=orders(path,profile,data,items,filter);
  else if (path===reviewsPath) content=reputation(profile,data,items,filter);
  else content=overview(profile,data,items,counts);
  return accountLayout(path,labels[path],content,profile,counts);
}

export function cartPage(entries,profile,counts,busy=false) {
  const content=heading('Góc người mua','Giỏ nhỏ, niềm vui to.',entries.length+' món trong giỏ. Kiểm tra lại trước khi gửi đề nghị mua.')+
    (!entries.length?empty('Giỏ hàng đang trống.','Thêm những món đồ bạn muốn trao đổi từ trang sản phẩm.')+link('Tiếp tục khám phá','/kham-pha','primary'):
    `<div class="cart-toolbar"><label><input type="checkbox" id="cart-all" ${busy?'disabled':''}> <span id="cart-selection-label">Chọn tất cả</span></label>${button('Xóa món đã chọn','cart-remove-selected','','quiet')}</div>
    <div class="cart-grid"><div class="account-rows">${entries.map(({id,item})=>`<article class="account-panel cart-item">
      <label><input type="checkbox" name="cart-item" value="${html(id)}" ${!item||busy?'disabled':''}> ${html(item?.seller||'Món đồ không còn trong danh mục')}</label>
      ${item?`<p class="cart-school">${html(item.school)} ${verified(item)}</p><div class="account-row-body"><img src="${html(item.images[0])}" alt="" loading="lazy"><div><h3><a href="${productPath(id)}">${html(item.title)}</a></h3><p>${html(item.condition)}${item.sample?' · Tin mẫu':''}</p>${priceMarkup(item)}</div></div>`:''}
      <div class="row-actions">${item&&!item.sample?button('Nhắn người bán','contact',id,'quiet'):''}${item?button('Lưu lại sau','cart-save',id,'quiet'):''}${button('Xóa','cart-remove',id,'quiet')}</div>
      </article>`).join('')}</div>
      <aside class="cart-summary"><h2>Món đồ bạn chọn</h2><dl><div><dt>Số món đồ</dt><dd id="cart-selected-count">0</dd></div><div><dt>Giao nhận</dt><dd>Thỏa thuận</dd></div></dl>
      <p class="eyebrow">Tạm tính</p><p class="display" id="cart-subtotal">0đ</p><p>Chưa bao gồm chi phí giao nhận (nếu có).</p>
      ${button('Gửi đề nghị mua','cart-submit','','primary')}<p>Mỗi người bán sẽ nhận đề nghị riêng. Hai bên thống nhất cách trả tiền và giao nhận qua tin nhắn.</p>${link('Tiếp tục khám phá','/kham-pha','quiet')}</aside>
    </div>
    <div class="account-tip"><h2>Một chút lưu ý trước khi chuyền tay</h2><p>Nhắn người bán để hẹn gặp ở nơi công cộng. Kiểm tra món đồ trước khi xác nhận đã nhận.</p></div>`);
  return accountLayout(cartPath,'Giỏ hàng',content,profile,counts);
}
