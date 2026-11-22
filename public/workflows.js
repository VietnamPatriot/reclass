import { categories, conditions, schools } from './catalog/data.js';
import { $, html, icon, productPath, sellerPath, categoryName, moreTags } from './views.js';
import { tagsFor } from './catalog/tags.js';

export const button=(title,action,id='',style='secondary')=>`<button type="button" class="button ${style}" data-action="${action}" data-id="${html(id)}">${title}</button>`;
const field=(label,name,value='',attributes='')=>`<label>${label}<input name="${name}" value="${html(value)}" ${attributes}></label>`;
const textarea=(label,name,value='',attributes='')=>`<label>${label}<textarea name="${name}" ${attributes}>${html(value)}</textarea></label>`;
const select=(label,name,items,selected)=>`<label>${label}<select name="${name}" required>${items.map(choice=>{
  const [value,title]=Array.isArray(choice)?choice:[choice,choice];
  return `<option value="${html(value)}" ${value===selected?'selected':''}>${html(title)}</option>`;
}).join('')}</select></label>`;
const form=(name,content,submit)=>`<form method="post" data-form="${name}">${content}<p class="form-error" role="alert" hidden></p><button class="button primary" type="submit">${submit}</button></form>`;
export const statusNames={pending:'Chờ duyệt',active:'Đang hiển thị',hidden:'Đã ẩn',rejected:'Cần chỉnh sửa',sold:'Đã trao tay',open:'Đang trao đổi',completed:'Đã hoàn tất',cancelled:'Đã hủy'};
const reportNames={site:'Nền tảng',listing:'Tin đăng',review:'Đánh giá',trade:'Giao dịch',appeal:'Kháng nghị'};
function tagOptions(category, selected=[]) {
  const tags=tagsFor(category);
  const featured=[...new Set([...tags.filter(tag=>selected.includes(tag.id)),...tags.slice(0,3)])];
  const render=({id,label})=>`<label><input type="checkbox" name="tags" value="${id}" ${selected.includes(id)?'checked':selected.length>=3?'disabled':''}> <span>${html(label)}</span></label>`;
  return featured.map(render).join('')+moreTags(tags.filter(tag=>!featured.includes(tag)),render);
}

async function jpeg(file) {
  if (file.size>15000000) throw new Error('Mỗi ảnh cần dưới 15 MB trước khi tải.');
  let image;
  try {image=await createImageBitmap(file);} catch {throw new Error('Hãy chọn tệp ảnh tương thích như JPEG, PNG hoặc WebP.');}
  try {
    const scale=Math.min(1,1400/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
    if (!blob) throw new Error('Không thể đọc ảnh đã chọn.');
    return blob;
  }finally {image.close();}
}

const emailInput=field('Email','email','','type="email" autocomplete="email" placeholder="ban@example.com" maxlength="254" required');
const passwordField=(title,name,attributes)=>`<div class="password-field">${field(title,name,'',attributes)}<button class="bare" type="button" data-action="toggle-password" aria-pressed="false" aria-label="Hiện ${title.toLowerCase()}">Hiện</button></div>`;
const passwordInput=passwordField('Mật khẩu','password','type="password" autocomplete="current-password" placeholder="Nhập mật khẩu của bạn" maxlength="128" required');

export function loginForm() {
  return form('login',emailInput+passwordInput+`<div class="auth-help">${button('Quên mật khẩu?','reset-password','','quiet')}${button('Gửi lại email xác nhận','resend','','quiet')}</div>`,'Đăng nhập');
}

export function registrationForm() {
  return form('register',field('Họ và tên','fullName','','required minlength="2" maxlength="100" autocomplete="name" placeholder="Nhập họ và tên của bạn"')+
    emailInput+passwordField('Mật khẩu','password','type="password" autocomplete="new-password" placeholder="Tạo mật khẩu từ 12 ký tự" required minlength="12" maxlength="128"')+
    passwordField('Xác nhận mật khẩu','passwordConfirmation','type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" required minlength="12" maxlength="128"')+
    '<fieldset class="student-fields"><legend>Thông tin học sinh</legend><p>Tên hiển thị và trường có thể xuất hiện trên gian hàng. RE:CLASS giữ riêng các thông tin xác minh khác.</p><div class="profile-fields">'+
    field('Ngày tháng năm sinh','birthDate','','type="date" required autocomplete="bday"')+
    field('Số điện thoại','phone','','type="tel" required minlength="8" maxlength="25" autocomplete="tel"')+
    field('Mã số học sinh','studentNumber','','required maxlength="50" autocomplete="off"')+
    select('Trường THPT','school',[['','Chọn trường của bạn'],...schools],'')+
    '</div>'+field('Tên hiển thị','name','','required minlength="2" maxlength="45" autocomplete="nickname"')+
    '<label>Ảnh giấy tờ tùy thân<input type="file" name="identityPhoto" accept="image/jpeg,image/png,image/webp" required><small>JPEG, PNG hoặc WebP. Tối đa 4 MB.</small></label></fieldset>'+
    button('Quyền riêng tư','privacy','','quiet'),'Tạo tài khoản');
}

export function editProfileForm(profile) {
  return form('profile','<div class="profile-fields">'+field('Tên hiển thị','name',profile.name,'required minlength="2" maxlength="45" autocomplete="nickname"')+
    field('Tên gian hàng','shop',profile.shop,'required minlength="2" maxlength="65"')+
    (profile.verified?`<label>Trường THPT<input value="${html(profile.school)}" readonly></label>`:select('Trường THPT','school',schools,profile.school))+
    '</div>'+textarea('Giới thiệu (không bắt buộc)','bio',profile.bio,'maxlength="350"'),'Lưu hồ sơ');
}

export function createWorkflows({api,notify,getSession,setProfile,refresh,refreshAccount}) {
  const dialog=$('#dialog');
  let modal={}, live;
  function open(title,body,context={}) {
    live?.close();
    live=undefined;
    modal=context;
    dialog.innerHTML=`<button type="button" class="dialog-close" data-action="close" aria-label="Đóng">${icon('close')}</button><h2 id="dialog-title">${title}</h2>${body}`;
    if (!dialog.open) dialog.showModal();
    if (dialog.contains(document.activeElement)) return;
    dialog.querySelector('.dialog-close').focus();
  }
  dialog.addEventListener('close',()=>{
    if (dialog.open) return;
    live?.close();
    live=undefined;
    modal={};
    dialog.replaceChildren();
  });
  function message(title,text,actions='') {
    open(title,text+(actions?'<div class="row-actions dialog-stack">'+actions+'</div>':''));
  }
  function showSample() {
    message('Tin đăng minh họa','<p>Món đồ này giúp bạn xem cách RE:CLASS hiển thị tin đăng. Bạn có thể xem thêm hoặc thử đăng một món đồ của mình.</p>',button('Đăng tin miễn phí','post','','primary'));
  }
  function signIn(resend=false) {
    open(resend?'Gửi lại liên kết xác nhận':'Đăng nhập RE:CLASS',
      (resend?form('resend',emailInput+passwordInput,'Gửi liên kết'):loginForm())+
      `<div class="row-actions dialog-stack">${resend?button('Về đăng nhập','sign-in'):'<a class="button secondary" href="/dang-ky">Tạo tài khoản</a>'}</div>`);
  }
  function profileForm() {
    const profile=getSession()?.profile;
    if (!profile) return signIn();
    open('Chỉnh sửa hồ sơ',editProfileForm(profile));
  }
  function verify() {
    open('Xác minh học sinh','<p>Nhập mã dùng một lần do đầu mối đã được chấp thuận của trường bạn cung cấp. Mã gắn với trường trong hồ sơ.</p>'+
      form('verify',field('Mã xác minh','code','','required minlength="8" maxlength="50" autocomplete="off"'),'Xác minh'));
  }
  function profileRequired(requireVerification=false) {
    const session=getSession();
    if (!session?.signed) {signIn();return false;}
    if (!session.profile) {signIn();return false;}
    if (requireVerification&&!session.profile.verified) {verify();return false;}
    return true;
  }
  async function account(page='/tai-khoan') {
    if (location.pathname.startsWith('/tai-khoan')) {
      dialog.close();
      await refreshAccount();
    } else location.assign(getSession()?.signed?page:'/dang-nhap');
  }
  async function post(id) {
    if (!profileRequired(true)) return;
    let item={};
    if (id) item=(await api('/api/listings/'+encodeURIComponent(id))).item;
    const category=item.category||categories[0].id;
    const photos=id?'Thêm ảnh mới để thay toàn bộ ảnh hiện tại.':'Tải từ 1 đến 3 ảnh thật của món đồ.';
    open(id?'Chỉnh sửa tin':'Đăng tin miễn phí','<p>Tin sẽ được kiểm duyệt trước khi hiển thị. '+photos+' Giữ thông tin cá nhân ở ngoài ảnh và nội dung tin.</p>'+
      form('listing',field('Tên món đồ','title',item.title,'required minlength="4" maxlength="100"')+
      select('Danh mục','category',categories.map(cat=>[cat.id,cat.name]),category)+
      `<fieldset class="post-tags"><legend>Thẻ sản phẩm (tối đa 3)</legend><div id="post-tag-options">${tagOptions(category,item.tags)}</div><p>RE:CLASS sẽ đề xuất thẻ từ mô tả nếu bạn để trống.</p></fieldset>`+
      select('Tình trạng','condition',conditions,item.condition)+
      field('Giá (đồng)','price',item.price,'required type="number" min="0" max="20000000" step="1"')+
      `<label class="check-label"><input type="checkbox" name="negotiable" ${item.negotiable?'checked':''}> Có thể thương lượng</label>`+
      textarea('Mô tả tình trạng và lưu ý','description',item.description,'required minlength="15" maxlength="1500"')+
      textarea('Cách giao nhận','delivery',item.delivery,'required minlength="8" maxlength="350" placeholder="Ví dụ: Hẹn ở khu vực công cộng gần trường"')+
      `<label>Ảnh món đồ<input type="file" name="photos" accept="image/*" multiple ${id?'':'required'}></label>`,'Gửi tin để duyệt'),{id});
  }
  function watch(path, update, status=()=>{}) {
    const source=new EventSource(path);
    const context=modal;
    let pending=false, changed=false;
    live=source;
    source.onopen=()=>status('Cập nhật trực tiếp');
    source.onerror=()=>status(source.readyState===EventSource.CLOSED?'Kết nối đã đóng. Mở lại để kết nối.':'Đang kết nối lại…');
    source.addEventListener('change',async()=>{
      changed=true;
      if (pending) return;
      pending=true;
      try {
        while (changed && modal===context && dialog.open) {
          changed=false;
          await update(context);
        }
      } catch (error) { if (modal===context && dialog.open) status(error.message); }
      finally { pending=false; }
    });
  }
  async function inbox() {
    if (!profileRequired()) return;
    const render=trades=>{
      const profile=getSession().profile;
      $('#inbox-threads').innerHTML=trades.map(trade=>`<article class="inline-box"><h3>${html(trade.title)}</h3><p>${html(trade.buyer_id===profile.id?trade.seller:trade.buyer)} · ${statusNames[trade.status]}</p><div class="row-actions">${button('Mở tin nhắn','trade',trade.id)}</div></article>`).join('')||'<p>Chưa có giao dịch nào.</p>';
    };
    const trades=await api('/api/inbox');
    open('Tin nhắn','<p class="chat-status" role="status">Đang kết nối…</p><div id="inbox-threads" class="dialog-stack"></div>'+button('Về tài khoản','account'));
    render(trades);
    watch('/api/inbox/events',async context=>{
      const next=await api('/api/inbox');
      if (modal===context && dialog.open) render(next);
    },text=>{dialog.querySelector('.chat-status').textContent=text;});
  }
  async function tradeView(id) {
    showTrade(await api('/api/trades/'+encodeURIComponent(id)));
  }
  function showTrade({trade,messages},draft='') {
    const id=trade.id;
    const me=getSession().profile.id;
    const confirmed=trade.buyer_id===me?trade.buyer_done:trade.seller_done;
    const canReview=trade.status==='completed'&&trade.buyer_id===me&&!trade.review_id;
    const messageForm=form('message',textarea('Tin nhắn','text',draft,'required maxlength="1000"'),'Gửi tin nhắn');
    const reviewForm=form('review',select('Điểm đánh giá','rating',[['','Chọn điểm'],...[5,4,3,2,1].map(value=>[String(value),value+' sao'])],'')+
      textarea('Đánh giá người bán','text','','required minlength="5" maxlength="700"'),'Gửi đánh giá');
    const conversationState=value=>[value.status,!!value.buyer_done,!!value.seller_done,value.review_id].join('/');
    let renderedMessages;
    const renderMessages=(entries,force=false)=>{
      const log=$('#chat-log');
      const messageIds=entries.map(item=>item.id).join('/');
      if (messageIds===renderedMessages) {if (force) log.scrollTop=log.scrollHeight; return;}
      renderedMessages=messageIds;
      const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<50;
      log.innerHTML=entries.map(item=>`<article class="inline-box trade-message${item.sender_id===me?' is-mine':''}">
        <strong>${html(item.name)}</strong><time datetime="${html(item.created)}">${html(new Date(item.created).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}))}</time>
        <p class="preserve-lines">${html(item.body)}</p></article>`).join('')||'<p>Chưa có tin nhắn. Hãy gửi lời chào và thống nhất cách giao nhận.</p>';
      if (force||nearBottom) log.scrollTop=log.scrollHeight;
    };
    const context={id,receive(next,force){
      if (conversationState(next.trade)!==conversationState(trade)) {
        const draft=dialog.querySelector('[data-form=message] textarea')?.value;
        showTrade(next,draft);
      } else renderMessages(next.messages,force);
    }};
    open('Trao đổi món đồ',`<p><a href="${productPath(trade.listing_id)}"><strong>${html(trade.title)}</strong></a> · ${statusNames[trade.status]}</p>
      <p class="small-note">Giữ thông tin cá nhân ở riêng. Hẹn trao đổi tại một địa điểm công cộng.</p>
      <p class="chat-status" role="status">Đang kết nối…</p><div id="chat-log" class="chat-log" role="log" aria-label="Tin nhắn giao dịch" tabindex="0"></div>
      ${trade.status==='open'?messageForm+'<p class="small-note">'+(confirmed?'Bạn đã xác nhận. Giao dịch hoàn tất khi cả hai bên xác nhận.':'Chỉ xác nhận sau khi đã giao nhận món đồ.')+'</p>':''}
      ${canReview?reviewForm:trade.review_id?'<p>Giao dịch đã có đánh giá.</p>':''}
      <div class="row-actions dialog-stack">${trade.status==='open'?(!confirmed?button('Xác nhận đã trao tay','trade-confirm',id,'primary'):'')+button('Hủy giao dịch','trade-cancel',id):''}
      ${button('Báo cáo','report-trade',id)}${button('Về tin nhắn','inbox')}</div>`,context);
    renderMessages(messages,true);
    watch('/api/trades/'+encodeURIComponent(id)+'/events',async active=>{
      const next=await api('/api/trades/'+encodeURIComponent(id));
      if (modal===active && dialog.open) active.receive(next);
    },text=>{dialog.querySelector('.chat-status').textContent=text;});
  }
  function report(kind,id) {
    if (!profileRequired()) return;
    open(kind==='appeal'?'Kháng nghị kiểm duyệt':'Báo cáo '+reportNames[kind].toLowerCase(),
      '<p>Cho đội kiểm duyệt biết chuyện gì đã xảy ra. Hãy giữ riêng số điện thoại, địa chỉ và giấy tờ cá nhân.</p>'+
      form('report',textarea('Nội dung','body','','required minlength="8" maxlength="1000"'),'Gửi'),{kind,id});
  }
  async function moderation(){
    const data=await api('/api/moderation');
    const pending=data.listings.map(item=>`<article class="inline-box"><h3><a href="${productPath(item.id)}">${html(item.title)}</a></h3><p>${categoryName(item.category)} · ${html(item.seller)}</p><p>${html(item.description)}</p><div class="row-actions">${button('Duyệt','approve',item.id,'primary')}${button('Yêu cầu chỉnh sửa','reject',item.id)}</div></article>`).join('');
    const reports=data.reports.map(item=>`<article class="inline-box"><h3>${reportNames[item.kind]}</h3><p class="preserve-lines">${html(item.body)}</p>
      ${['listing','appeal'].includes(item.kind)?'<a href="'+productPath(item.target)+'">Xem tin đăng</a>':''}
      <div class="row-actions">${item.kind==='listing'?button('Gỡ tin','remove',item.target):''}
        ${item.kind==='review'?button('Ẩn đánh giá','hide-review',item.id):''}
        ${item.kind==='appeal'?button('Đưa lại vào hàng chờ','requeue',item.id):''}
        ${button('Đánh dấu đã xử lý','resolve',item.id)}</div></article>`).join('');
    open('Bảng kiểm duyệt','<div class="dialog-stack"><h3>Mã xác minh học sinh</h3><p>Chỉ phát mã cho đầu mối được trường chấp thuận. Mã dùng một lần và có hiệu lực 7 ngày.</p>'+
      form('invite',select('Trường THPT','school',schools,schools[0]),'Tạo mã xác minh')+
      '<h3>Tin chờ duyệt</h3>'+(pending||'<p>Hàng chờ hiện đang trống.</p>')+'<h3>Báo cáo & kháng nghị</h3>'+(reports||'<p>Chưa có báo cáo mới.</p>')+button('Về tài khoản','account')+'</div>');
  }
  const info={
    about:['Về RE:CLASS','<p>Chúng mình là một nhóm học sinh THPT muốn việc trao đổi sách, đồng phục và dụng cụ học tập trở nên dễ dàng hơn. Mỗi lần một món đồ đến tay người cần, món đó lại có thêm một vòng đời.</p><p>RE:CLASS tập trung vào đồ học đường, với hồ sơ học sinh đã xác minh, quy chuẩn tin đăng và đánh giá từ các giao dịch đã xác nhận.</p>'],
    safety:['Giao dịch an toàn','<p>Kiểm tra ảnh, tình trạng và hồ sơ người bán. Chọn nơi công cộng phù hợp để gặp và kiểm tra món đồ trước khi nhận. Chỉ xác nhận khi đã hoàn tất trao đổi.</p><p>Giữ riêng số điện thoại, địa chỉ nhà, lịch học và giấy tờ học sinh. Báo cáo tin đăng, tin nhắn hoặc đánh giá có dấu hiệu vi phạm.</p>'],
    rules:['Quy chuẩn đăng tin','<p>RE:CLASS tiếp nhận sách và tài liệu, đồng phục, dụng cụ học tập, phụ kiện học đường và đồ dùng ngoại khóa phù hợp. Mỗi tin cần ảnh thật, giá, tình trạng và cách giao nhận.</p><p>Tin ngoài phạm vi học đường, hàng không rõ nguồn gốc và đồ vật nguy hiểm sẽ bị từ chối. Đội ngũ duyệt nội dung tin đăng. Hãy kiểm tra món đồ trước khi nhận.</p>'],
    privacy:['Quyền riêng tư','<p>Gian hàng hiển thị tên bạn chọn, trường, trạng thái xác minh, sản phẩm và đánh giá. Họ và tên, ngày sinh, số điện thoại, mã số học sinh và ảnh giấy tờ bạn gửi khi đăng ký được lưu riêng trên máy chủ.</p><p>Tin nhắn chỉ hiển thị cho hai bên giao dịch. Báo cáo do đội kiểm duyệt xử lý. Cookie giữ phiên đăng nhập trên thiết bị này. Tin đã lưu khi đăng nhập đi theo tài khoản của bạn.</p>']
  };
  async function handle(action,id,trigger) {
    if (Object.hasOwn(info,action)) {message(...info[action]);return;}
    if (action==='close') return dialog.close();
    if (action==='account') return account();
    if (action==='sign-in'||action==='resend') return signIn(action==='resend');
    if (action==='register') return location.assign('/dang-ky');
    if (action==='toggle-password') {
      const input=trigger.parentElement.querySelector('input');
      const shown=input.type==='password';
      input.type=shown?'text':'password';
      trigger.textContent=shown?'Ẩn':'Hiện';
      trigger.setAttribute('aria-pressed',shown);
      return;
    }
    if (action==='reset-password') return open('Đặt lại mật khẩu',form('reset-password',emailInput,'Gửi liên kết')+button('Về đăng nhập','sign-in'));
    if (action==='sign-out') {await api('/api/logout',{});location.assign('/');return;}
    if (action==='inbox') return inbox();
    if (action==='edit-profile') return profileForm();
    if (action==='verify') return verify();
    if (action==='post'||action==='edit') return post(id);
    if (action==='moderation') return moderation();
    if (action==='claim') return open('Quyền kiểm duyệt','<p>Nhập mã quản trị của đợt thử nghiệm.</p>'+form('claim',field('Mã quản trị','code','','type="password" minlength="8" maxlength="100" required'),'Kích hoạt quyền'));
    if (action==='contact') {
      if (!profileRequired(true)) return;
      const trade=await api('/api/trades',{listingId:id});
      return tradeView(trade.id);
    }
    if (action==='trade') return tradeView(id);
    if (action==='trade-confirm'||action==='trade-cancel') {
      const confirm=action==='trade-confirm';
      return open(confirm?'Xác nhận đã trao tay':'Hủy giao dịch', '<p>'+(confirm?'Chỉ xác nhận sau khi bạn đã giao hoặc nhận món đồ.':'Giao dịch sẽ kết thúc và hai bên sẽ không thể gửi thêm tin nhắn.')+'</p>'+
        form('trade-state','',confirm?'Xác nhận giao dịch':'Hủy giao dịch')+button('Quay lại','trade',id),{id,op:confirm?'confirm':'cancel'});
    }
    const reportTypes={report:'listing','report-site':'site','report-review':'review','report-trade':'trade',appeal:'appeal'};
    if (Object.hasOwn(reportTypes,action)) return report(reportTypes[action],id);
    if (action==='listing-hide'||action==='listing-submit') {
      await api('/api/listings/'+encodeURIComponent(id)+'/status',{action:action.slice(8)});
      return account('/tai-khoan/tin-dang');
    }
    if (action==='reject'||action==='remove') return open(action==='reject'?'Yêu cầu chỉnh sửa':'Gỡ tin đăng',
      form('moderate',textarea('Lý do','reason','','required minlength="5" maxlength="400"'),'Xác nhận'),{id,op:action});
    if (action==='approve') {
      await api('/api/moderation/listings/'+encodeURIComponent(id),{action});
      await refresh();return moderation();
    }
    if (['resolve','hide-review','requeue'].includes(action)) {
      await api('/api/moderation/reports/'+encodeURIComponent(id),{action});return moderation();
    }
  }
  dialog.addEventListener('change',event=>{
    const field=event.target;
    const container=dialog.querySelector('#post-tag-options');
    if (!container) return;
    if (field.name==='category') container.innerHTML=tagOptions(field.value);
    if (field.name==='tags') {
      const tags=[...container.querySelectorAll('input')];
      const full=tags.filter(input=>input.checked).length>=3;
      tags.forEach(input=>{input.disabled=full&&!input.checked;});
    }
  });
  document.addEventListener('submit',async event=>{
    const current=event.target;
    if (!current.dataset.form) return;
    event.preventDefault();
    const data=new FormData(current);
    const kind=current.dataset.form;
    const inline=!dialog.contains(current);
    const context=modal;
    const err=current.querySelector('.form-error');
    const submit=current.querySelector('[type=submit]');
    submit.disabled=true;err.hidden=true;
    try {
      if (kind==='register') {
        if (data.get('password')!==data.get('passwordConfirmation')) throw new Error('Hai mật khẩu chưa khớp.');
        data.delete('passwordConfirmation');
        const photo=data.get('identityPhoto');
        if (!photo?.size||photo.size>4000000) throw new Error('Hãy chọn một ảnh giấy tờ tối đa 4 MB.');
        await api('/api/register',data);
        if (current.isConnected) {
          current.reset();
          message('Kiểm tra email','<p>Nếu địa chỉ đủ điều kiện, bạn sẽ nhận được liên kết xác nhận. Sau khi xác nhận, hãy đăng nhập để dùng RE:CLASS.</p>','<a class="button primary" href="/dang-nhap">Về đăng nhập</a>'+button('Gửi lại liên kết','resend'));
        }
      } else if (kind==='login'||kind==='resend') {
        await api('/api/login',{...Object.fromEntries(data),resend:kind==='resend'});
        if (kind==='login') {
          if (inline&&location.pathname==='/dang-nhap') {
            const next=new URLSearchParams(location.search).get('tiep');
            location.replace(next==='/gio-hang'?next:'/tai-khoan');
          } else location.reload();
        }
        else if (modal===context && dialog.open) message('Kiểm tra email','<p>Hãy mở liên kết xác nhận trước khi đăng nhập.</p>',button('Về đăng nhập','sign-in'));
      } else if (kind==='reset-password') {
        await api('/api/reset-password',Object.fromEntries(data));
        if (modal===context && dialog.open) message('Kiểm tra email','<p>Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu.</p>',button('Về đăng nhập','sign-in'));
      } else if (kind==='profile'||kind==='verify'||kind==='claim') {
        const path={profile:'/api/profile',verify:'/api/verify',claim:'/api/moderation/claim'}[kind];
        setProfile(await api(path,Object.fromEntries(data)));
        if (kind==='verify') notify('Đã xác minh hồ sơ học sinh.');
        if (kind==='profile') notify('Đã lưu hồ sơ.');
        if ((kind==='verify'||kind==='claim')&&location.pathname==='/gio-hang') dialog.close();
        else await account();
      } else if (kind==='listing') {
        const files=data.getAll('photos').filter(file=>file.size);
        if (files.length>3) throw new Error('Hãy chọn tối đa 3 ảnh.');
        data.delete('photos');
        for (const file of files) data.append('photos',await jpeg(file),'listing.jpg');
        await api('/api/listings'+(context.id?'/'+encodeURIComponent(context.id):''),data);
        notify('Đã gửi tin vào hàng chờ kiểm duyệt.');
        await refresh();await account('/tai-khoan/tin-dang');
      } else if (kind==='message') {
        const text=current.elements.namedItem('text');
        const draft=text.value;
        context.pendingMessage ||= {};
        if (context.pendingMessage.text!==draft) context.pendingMessage={text:draft,id:crypto.randomUUID()};
        const next=await api('/api/trades/'+encodeURIComponent(context.id),{action:'message',text:draft,messageId:context.pendingMessage.id});
        context.pendingMessage={};
        if (text.value===draft) text.value='';
        if (modal===context && dialog.open) context.receive(next,true);
      } else if (kind==='review'||kind==='trade-state') {
        const next=await api('/api/trades/'+encodeURIComponent(context.id),{action:kind==='trade-state'?context.op:kind,...Object.fromEntries(data)});
        if(kind==='review') notify('Đã gửi đánh giá.');
        if (modal===context && dialog.open) showTrade(next);
      } else if (kind==='report') {
        await api('/api/reports',{kind:context.kind,target:context.id,body:data.get('body')});
        dialog.close();notify('Đã gửi đến đội kiểm duyệt.');
      } else if (kind==='invite') {
        const result=await api('/api/moderation/invite',{school:data.get('school')});
        message('Mã xác minh một lần','<p>'+html(result.school)+' · Có hiệu lực 7 ngày</p><p class="invite-code"><strong>'+html(result.code)+'</strong></p>',button('Về bảng kiểm duyệt','moderation'));
      } else if (kind==='moderate') {
        await api('/api/moderation/listings/'+encodeURIComponent(context.id),{action:context.op,reason:data.get('reason')});
        await refresh();await moderation();
      }
    }catch(error){if(current.isConnected){err.textContent=error.message;err.hidden=false;}else notify(error.message);}
    finally{submit.disabled=false;}
  });
  return {handle,showSample,profileRequired,showLink:link=>message('Chia sẻ tin đăng','<label>Đường dẫn<input readonly value="'+html(link)+'"></label>')};
}
