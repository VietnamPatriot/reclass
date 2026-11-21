const taxonomy = {
  sach: [
    ['on-thi','Ôn thi','luyện thi|ôn thi|ôn tập|đề thi|toán 12'],
    ['toan','Toán học','toán|hình học|đại số'],
    ['ngoai-ngu','Ngoại ngữ','tiếng anh|từ vựng|flashcard|ngoại ngữ|ielts'],
    ['khoa-hoc','Khoa học','hóa học|hoá học|vật lý|sinh học|thí nghiệm'],
    ['sach-giao-khoa','Sách giáo khoa','sách giáo khoa|sgk|giáo trình']
  ],
  'dung-cu': [
    ['may-tinh','Máy tính','máy tính|casio|vinacal'],
    ['but-va-vo','Bút & vở','vở|sổ tay|sổ lò xo|bút|giấy kẻ'],
    ['hinh-hoc','Thước & compa','compa|thước|ê ke|góc kế|hình học'],
    ['den-hoc','Đèn học','đèn học|đèn bàn|đèn led']
  ],
  'dong-phuc': [
    ['ao-trang','Áo trắng','áo trắng|áo đồng phục trắng|áo sơ mi'],
    ['vay-quan','Váy & quần','chân váy|váy xếp ly|quần dài'],
    ['ao-the-thao','Áo thể thao','áo thể thao|áo tập|thể dục'],
    ['ao-khoac','Áo khoác','áo khoác|áo nỉ|áo zip'],
    ['ao-lop','Áo lớp','áo lớp|áo nhóm']
  ],
  clb: [
    ['bong-ro','Bóng rổ','bóng rổ|basketball'],
    ['cau-long','Cầu lông','cầu lông|vợt|quả cầu'],
    ['am-nhac','Âm nhạc','ukulele|nhạc cụ|guitar|âm nhạc'],
    ['hoi-hoa','Hội họa','màu nước|hội họa|màu vẽ|cọ vẽ']
  ],
  'phu-kien': [
    ['tui-but','Túi bút','túi bút|hộp bút|bóp bút'],
    ['balo-va-tui','Balo & túi','balo|ba lô|túi tote|túi canvas'],
    ['binh-nuoc','Bình nước','bình nước|bình giữ nhiệt'],
    ['the-hoc-sinh','Phụ kiện thẻ','bao thẻ|dây đeo thẻ|phụ kiện thẻ']
  ]
};

export function normalize(value='') {
  return value.toLocaleLowerCase('vi-VN').normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replaceAll('đ','d').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

const byCategory = Object.fromEntries(Object.entries(taxonomy).map(([category,tags])=>[
  category,tags.map(([id,label,terms])=>({id,label,terms:terms.split('|'),keys:terms.split('|').map(normalize)}))
]));
const allTags = Object.values(byCategory).flat();
export const tag = id => allTags.find(item=>item.id===id);
export const categoryForTag = id => Object.keys(byCategory).find(category=>byCategory[category].some(item=>item.id===id))||'';
export const tagsFor = category => (category ? byCategory[category] : allTags) || [];

export function inferredTags(category,...fields) {
  const text=' '+normalize(fields.filter(Boolean).join(' '))+' ';
  return tagsFor(category).filter(item=>item.keys.some(key=>text.includes(' '+key+' '))).map(item=>item.id).slice(0,3);
}
