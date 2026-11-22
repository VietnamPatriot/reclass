export const listingPriceLimit = 20_000_000;

export function priceLimit(value) {
  return typeof value==='string'&&/^\d{1,8}$/.test(value)&&Number(value)<=listingPriceLimit ? String(Number(value)) : '';
}

export function activeOffer(item, now=Date.now()) {
  const price=item.offer?.price;
  const endsAt=Date.parse(item.offer?.endsAt);
  if (item.status!=='active'||!Number.isFinite(endsAt)||endsAt<=now||!Number.isInteger(price)||price<0||price>=item.price) return null;
  const discount=Math.round((item.price-price)/item.price*100);
  return {price,discount,endsAt};
}

export function effectivePrice(item, now=Date.now()) {
  return activeOffer(item,now)?.price ?? item.price;
}

export function countdown(endsAt, now=Date.now()) {
  const seconds=Math.max(0,Math.ceil((endsAt-now)/1000));
  const days=Math.floor(seconds/86_400);
  const pad=value=>String(value).padStart(2,'0');
  const time=[Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60].map(pad).join(':');
  return days ? days+' ngày '+time : time;
}
