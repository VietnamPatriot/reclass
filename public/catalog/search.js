import { categories, popularSearches } from './data.js';
import { normalize, tag, tagsFor } from './tags.js';
import { effectivePrice } from './offers.js';

const words = value => normalize(value).split(' ').filter(Boolean);
const categoryNames = Object.fromEntries(categories.map(({id,name})=>[id,name]));
const budgetPattern = /(?:^|\s)(?:dưới|duoi|tối đa|toi da)\s+(\d+(?:[.,]\d{3})*)(?:\s*(k|nghìn|nghin|đ|d|vnd))?(?=\s|$)/iu;

function parseQuery(value) {
  const match = value.match(budgetPattern);
  if (!match) return { terms:words(value), max:Infinity };
  const amount=Number(match[1].replace(/[.,]/g,''));
  const max=/^(?:k|nghin)$/.test(normalize(match[2]||'')) ? amount*1000 : amount;
  const text=(value.slice(0,match.index)+' '+value.slice(match.index+match[0].length)).trim().replace(/^(?:đồ|do)$/i,'');
  return {terms:words(text),max};
}

function oneEdit(a,b) {
  if (Math.abs(a.length-b.length)>1) return false;
  let i=0;
  while (i<a.length&&a[i]===b[i]) i++;
  if (a.length===b.length) {
    return a.slice(i+1)===b.slice(i+1) ||
      (a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
  }
  return a.length>b.length ? a.slice(i+1)===b.slice(i) : b.slice(i+1)===a.slice(i);
}

function tokenScore(term, tokens, allowTypo) {
  let best=0;
  for (const word of tokens) {
    if (word===term) return 5;
    if (word.startsWith(term)) best=Math.max(best,3);
    else if (allowTypo&&term.length>=4&&word.length>=3&&oneEdit(term,word)) best=Math.max(best,2);
  }
  return best;
}

export function indexListings(listings) {
  return listings.map(item=>{
    const labels=(item.tags||[]).map(id=>tag(id)?.label).filter(Boolean);
    const aliases=(item.tags||[]).flatMap(id=>tag(id)?.terms||[]);
    return {
      item,
      primary:words([item.title,...labels].join(' ')),
      secondary:words([item.keywords,categoryNames[item.category],...aliases].filter(Boolean).join(' ')),
      supporting:words([item.description,item.school,item.condition].filter(Boolean).join(' '))
    };
  });
}

export function rankListings(index, query) {
  const {terms,max}=parseQuery(query);
  const matches=[];
  const now=Date.now();
  for (const record of index) {
    if (effectivePrice(record.item,now)>max) continue;
    const hits=terms.map(term=>{
      const primary=tokenScore(term,record.primary,true);
      const secondary=tokenScore(term,record.secondary,true);
      const supporting=tokenScore(term,record.supporting,false);
      return {score:Math.max(primary*4,secondary*3,supporting),direct:primary>=3||secondary>=3};
    });
    if (hits.some(hit=>!hit.score)) continue;
    matches.push({
      item:record.item,
      score:hits.reduce((sum,hit)=>sum+hit.score,0),
      direct:hits.every(hit=>hit.direct)
    });
  }
  const direct=matches.filter(match=>match.direct);
  return (direct.length?direct:matches).sort((a,b)=>b.score-a.score).map(match=>match.item);
}

export function suggestionPool(index) {
  const activeTags=new Set(index.flatMap(({item})=>item.tags||[]));
  const activeCategories=new Set(index.map(({item})=>item.category));
  return [
    ...popularSearches.filter(text=>rankListings(index,text).length).map(text=>({text,priority:3})),
    ...tagsFor('').filter(item=>activeTags.has(item.id))
      .map(item=>({text:item.label,priority:1})),
    ...categories.filter(item=>activeCategories.has(item.id)).map(item=>({text:item.name,priority:0}))
  ];
}

export function suggestionsFor(pool,recent,query,limit=6) {
  const input=normalize(query);
  const candidates=[...recent.map(text=>({text,priority:5,recent:true})),...pool];
  const seen=new Set();
  const ranked=[];
  for (const candidate of candidates) {
    const key=normalize(candidate.text);
    if (seen.has(key)) continue;
    seen.add(key);
    const scores=words(input).map(term=>tokenScore(term,key.split(' '),true));
    if (scores.includes(0)) continue;
    const starts=input&&key.startsWith(input)?15:0;
    const score=candidate.priority+starts+scores.reduce((sum,value)=>sum+value,0);
    ranked.push({...candidate,score});
  }
  return ranked.sort((a,b)=>b.score-a.score).slice(0,limit);
}
