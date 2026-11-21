import { categories, conditions, schools } from './data.js';
import { $, html, icon, productPath, sellerPath, categoryName } from './views.js';

const button=(title,action,id='',style='secondary')=>`<button type="button" class="button ${style}" data-action="${action}" data-id="${html(id)}">${title}</button>`;
const field=(label,name,value='',attributes='')=>`<label>${label}<input name="${name}" value="${html(value)}" ${attributes}></label>`;
const textarea=(label,name,value='',attributes='')=>`<label>${label}<textarea name="${name}" ${attributes}>${html(value)}</textarea></label>`;
const select=(label,name,items,selected)=>`<label>${label}<select name="${name}" required>${items.map(choice=>{
  const [value,title]=Array.isArray(choice)?choice:[choice,choice];
  return `<option value="${html(value)}" ${value===selected?'selected':''}>${html(title)}</option>`;
}).join('')}</select></label>`;
const form=(name,content,submit)=>`<form data-form="${name}">${content}<p class="form-error" role="alert" hidden></p><button class="button primary" type="submit">${submit}</button></form>`;
const statusNames={pending:'Chờ duyệt',active:'Đang hiển thị',hidden:'Đã ẩn',rejected:'Cần chỉnh sửa',sold:'Đã trao tay',open:'Đang trao đổi',completed:'Đã hoàn tất',cancelled:'Đã hủy'};
const reportNames={site:'Nền tảng',listing:'Tin đăng',review:'Đánh giá',trade:'Giao dịch',appeal:'Kháng nghị'};
const demoNames={seller:'Người bán thử',buyer:'Người mua thử',moderator:'Kiểm duyệt thử'};

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

export function createWorkflows({api,notify,getSession,setProfile,refresh}) {
  const dialog=$('#dialog');
  let modal={};
  function open(title,body,context={}) {
    modal=context;
    dialog.innerHTML=`<button type="button" class="dialog-close" data-action="close" aria-label="Đóng">${icon('close')}</button><h2 id="dialog-title">${title}</h2>${body}`;
    if (!dialog.open) dialog.showModal();
    if (dialog.contains(document.activeElement)) return;
    dialog.querySelector('.dialog-close').focus();
  }
  function message(title,text,actions='') {
    open(title,text+(actions?'<div class="row-actions dialog-stack">'+actions+'</div>':''));
  }
  function showSample() {
    message('Tin đăng minh họa','<p>Món đồ này giúp bạn xem cách RE:CLASS hiển thị tin đăng. Bạn có thể xem thêm hoặc thử đăng một món đồ của mình.</p>',button('Đăng tin miễn phí','post','','primary'));
  }
  function signIn() {
    const session=getSession();
    if (!session) return message('Đang kết nối','<p>RE:CLASS đang tải thông tin tài khoản. Hãy thử lại sau một chút.</p>');
    if (session.local) {
      return message('Tài khoản thử nghiệm','<p>Chọn một tài khoản để thử luồng người mua, người bán hoặc kiểm duyệt.</p>',session.demoAccounts.map(id=>button(demoNames[id],'demo',id)).join(''));
    }
    const back=location.pathname+location.search;
    message('Đăng nhập RE:CLASS','<p>Đăng nhập để tạo hồ sơ học sinh, lưu thông tin gian hàng và tham gia trao đổi.</p>',
      '<a class="button primary" href="/signin-with-chatgpt?return_to='+encodeURIComponent(back)+'" target="_top">Đăng nhập với ChatGPT</a>');
  }
  function profileForm() {
    const profile=getSession()?.profile;
    open(profile?'Chỉnh sửa hồ sơ':'Tạo hồ sơ học sinh','<p>Chọn tên hiển thị và trường của bạn. Tên hiển thị và tên trường sẽ xuất hiện trong gian hàng sau khi xác minh.</p>'+
      form('profile',field('Tên hiển thị','name',profile?.name,'required minlength="2" maxlength="45" autocomplete="nickname"')+
      field('Tên gian hàng','shop',profile?.shop,'required minlength="2" maxlength="65"')+
      (profile?.verified?'<p>'+html(profile.school)+'</p>':select('Trường THPT','school',[['','Chọn trường của bạn'],...schools],profile?.school??''))+
      textarea('Giới thiệu (không bắt buộc)','bio',profile?.bio,'maxlength="350"'),'Lưu hồ sơ'));
  }
  function verify() {
    open('Xác minh học sinh','<p>Nhập mã dùng một lần do đầu mối đã được chấp thuận của trường bạn cung cấp. Mã gắn với trường trong hồ sơ. Hãy giữ riêng mã học sinh và giấy tờ cá nhân.</p>'+
      form('verify',field('Mã xác minh','code','','required minlength="8" maxlength="50" autocomplete="off"'),'Xác minh'));
  }
  function profileRequired(requireVerification=false) {
    const session=getSession();
    if (!session?.signed) {signIn();return false;}
    if (!session.profile) {profileForm();return false;}
    if (requireVerification&&!session.profile.verified) {verify();return false;}
    return true;
  }
  async function account(){
    const session=getSession();
    if (!session?.signed) return signIn();
    if (!session.profile) return profileForm();
    const profile=session.profile;
    const data=await api('/api/dashboard');
    const listings=data.listings.map(item=>`<article class="inline-box"><h3><a href="${productPath(item.id)}">${html(item.title)}</a></h3><p>${statusNames[item.status]}${item.reason?' · '+html(item.reason):''}</p>
      <div class="row-actions">${item.status!=='sold'?button('Sửa tin','edit',item.id):''}
      ${['active','pending'].includes(item.status)?button('Ẩn tin','listing-hide',item.id):''}
      ${item.status==='hidden'?button('Gửi lại để duyệt','listing-submit',item.id):''}
      ${item.status==='rejected'?button('Gửi kháng nghị','appeal',item.id):''}</div></article>`).join('');
    const trades=data.trades.map(trade=>`<article class="inline-box"><h3>${html(trade.title)}</h3><p>${html(trade.buyer_id===profile.id?trade.seller:trade.buyer)} · ${statusNames[trade.status]}</p><div class="row-actions">${button('Mở giao dịch','trade',trade.id)}</div></article>`).join('');
    open('Tài khoản RE:CLASS',`<p><strong>${html(profile.name)}</strong> · ${html(profile.school)}<br>${profile.verified?'Đã xác minh học sinh':'Chưa xác minh học sinh'}</p>
      <div class="row-actions dialog-stack">${button('Sửa hồ sơ','edit-profile')}${profile.verified?'<a class="button secondary" href="'+sellerPath(profile.id)+'">Gian hàng của mình</a>':button('Nhập mã xác minh','verify','','primary')}
      <a class="button secondary" href="/da-luu">Tin đã lưu</a>${profile.moderator?button('Bảng kiểm duyệt','moderation'):button('Quyền kiểm duyệt','claim')}</div>
      <div class="dialog-stack"><h3>Tin của bạn</h3>${listings||'<p>Chưa có tin đăng.</p>'}${button('Đăng tin miễn phí','post','','primary')}</div>
      <div class="dialog-stack"><h3>Giao dịch & tin nhắn</h3>${trades||'<p>Chưa có giao dịch nào.</p>'}</div>
      <div class="row-actions dialog-stack">${session.local?session.demoAccounts.filter(id=>id!==session.activeDemo).map(id=>button(demoNames[id],'demo',id)).join('')+button('Đăng xuất','demo','sign-out'):'<a class="button quiet" href="/signout-with-chatgpt?return_to=%2F" target="_top">Đăng xuất</a>'}</div>`);
  }
  async function post(id) {
    if (!profileRequired(true)) return;
    let item={};
    if (id) item=(await api('/api/listings/'+encodeURIComponent(id))).item;
    const photos=id?'Thêm ảnh mới để thay toàn bộ ảnh hiện tại.':'Tải từ 1 đến 3 ảnh thật của món đồ.';
    open(id?'Chỉnh sửa tin':'Đăng tin miễn phí','<p>Tin sẽ được kiểm duyệt trước khi hiển thị. '+photos+' Giữ thông tin cá nhân ở ngoài ảnh và nội dung tin.</p>'+
      form('listing',field('Tên món đồ','title',item.title,'required minlength="4" maxlength="100"')+
      select('Danh mục','category',categories.map(cat=>[cat.id,cat.name]),item.category)+
      select('Tình trạng','condition',conditions,item.condition)+
      field('Giá (đồng)','price',item.price,'required type="number" min="0" max="20000000" step="1"')+
      `<label class="check-label"><input type="checkbox" name="negotiable" ${item.negotiable?'checked':''}> Có thể thương lượng</label>`+
      textarea('Mô tả tình trạng và lưu ý','description',item.description,'required minlength="15" maxlength="1500"')+
      textarea('Cách giao nhận','delivery',item.delivery,'required minlength="8" maxlength="350" placeholder="Ví dụ: Hẹn ở khu vực công cộng gần trường"')+
      `<label>Ảnh món đồ<input type="file" name="photos" accept="image/*" multiple ${id?'':'required'}></label>`,'Gửi tin để duyệt'),{id});
  }
  async function tradeView(id) {
    const {trade,messages}=await api('/api/trades/'+encodeURIComponent(id));
    const me=getSession().profile.id;
    const confirmed=trade.buyer_id===me?trade.buyer_done:trade.seller_done;
    const sent=messages.map(item=>`<article class="inline-box trade-message"><strong>${html(item.name)}</strong><p class="preserve-lines">${html(item.body)}</p></article>`).join('');
    const canReview=trade.status==='completed'&&trade.buyer_id===me&&!trade.review_id;
    const messageForm=form('message',textarea('Tin nhắn','text','','required maxlength="1000"'),'Gửi tin nhắn');
    const reviewForm=form('review',select('Điểm đánh giá','rating',[['','Chọn điểm'],...[5,4,3,2,1].map(value=>[String(value),value+' sao'])],'')+
      textarea('Đánh giá người bán','text','','required minlength="5" maxlength="700"'),'Gửi đánh giá');
    open('Trao đổi món đồ',`<p><a href="${productPath(trade.listing_id)}"><strong>${html(trade.title)}</strong></a> · ${statusNames[trade.status]}</p>
      <p class="small-note">Giữ thông tin cá nhân ở riêng. Hẹn trao đổi tại một địa điểm công cộng.</p>
      <div class="dialog-stack">${sent||'<p>Chưa có tin nhắn. Hãy gửi lời chào và thống nhất cách giao nhận.</p>'}</div>
      ${trade.status==='open'?messageForm+'<p class="small-note">'+(confirmed?'Bạn đã xác nhận. Giao dịch hoàn tất khi cả hai bên xác nhận.':'Chỉ xác nhận sau khi đã giao nhận món đồ.')+'</p>':''}
      ${canReview?reviewForm:trade.review_id?'<p>Giao dịch đã có đánh giá.</p>':''}
      <div class="row-actions dialog-stack">${trade.status==='open'?(!confirmed?button('Xác nhận đã trao tay','trade-confirm',id,'primary'):'')+button('Hủy giao dịch','trade-cancel',id):''}
      ${button('Làm mới','trade',id)}${button('Báo cáo','report-trade',id)}${button('Về tài khoản','account')}</div>`,{id});
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
    privacy:['Quyền riêng tư','<p>Gian hàng hiển thị tên bạn chọn, trường, trạng thái xác minh, sản phẩm và đánh giá. Mã xác minh dùng một lần được lưu dưới dạng băm. Hãy giữ riêng mã số học sinh và giấy tờ cá nhân.</p><p>Tin nhắn chỉ hiển thị cho hai bên giao dịch. Báo cáo do đội kiểm duyệt xử lý. Chủ đề giao diện và tin đã lưu được giữ trên trình duyệt này.</p>']
  };
  async function handle(action,id) {
    if (Object.hasOwn(info,action)) {message(...info[action]);return;}
    if (action==='close') return dialog.close();
    if (action==='account') return account();
    if (action==='edit-profile') return profileForm();
    if (action==='verify') return verify();
    if (action==='post'||action==='edit') return post(id);
    if (action==='moderation') return moderation();
    if (action==='claim') return open('Quyền kiểm duyệt','<p>Nhập mã quản trị của đợt thử nghiệm.</p>'+form('claim',field('Mã quản trị','code','','type="password" minlength="8" maxlength="100" required'),'Kích hoạt quyền'));
    if (action==='demo') {await api('/dev/account?as='+encodeURIComponent(id),{});location.reload();return;}
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
      await refresh();return account();
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
  dialog.addEventListener('submit',async event=>{
    const current=event.target;
    if (!current.dataset.form) return;
    event.preventDefault();
    const data=new FormData(current);
    const kind=current.dataset.form;
    const context=modal;
    const err=current.querySelector('.form-error');
    const submit=current.querySelector('[type=submit]');
    submit.disabled=true;err.hidden=true;
    try {
      if (kind==='profile'||kind==='verify'||kind==='claim') {
        const path={profile:'/api/profile',verify:'/api/verify',claim:'/api/moderation/claim'}[kind];
        setProfile(await api(path,Object.fromEntries(data)));
        if (kind==='verify') notify('Đã xác minh hồ sơ học sinh.');
        await account();
      } else if (kind==='listing') {
        const files=data.getAll('photos').filter(file=>file.size);
        if (files.length>3) throw new Error('Hãy chọn tối đa 3 ảnh.');
        data.delete('photos');
        for (const file of files) data.append('photos',await jpeg(file),'listing.jpg');
        await api('/api/listings'+(context.id?'/'+encodeURIComponent(context.id):''),data);
        notify('Đã gửi tin vào hàng chờ kiểm duyệt.');
        await refresh();await account();
      } else if (['message','review','trade-state'].includes(kind)) {
        await api('/api/trades/'+encodeURIComponent(context.id),{action:kind==='trade-state'?context.op:kind,...Object.fromEntries(data)});
        if(kind==='review') notify('Đã gửi đánh giá.');
        await tradeView(context.id);
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
  return {handle,showSample,showLink:link=>message('Chia sẻ tin đăng','<label>Đường dẫn<input readonly value="'+html(link)+'"></label>')};
}
