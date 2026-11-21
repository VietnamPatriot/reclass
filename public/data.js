import { inferredTags } from './tags.js';

export const categories = [
  { id:'sach', name:'Sách & tài liệu', short:'Sách & tài liệu', hint:'Góc sách cho mùa thi', image:'books' },
  { id:'dung-cu', name:'Dụng cụ học tập', short:'Dụng cụ học tập', hint:'Từ chiếc bút đến máy tính', image:'calculator' },
  { id:'dong-phuc', name:'Đồng phục & áo lớp', short:'Đồng phục', hint:'Thêm một năm đồng hành', image:'uniform' },
  { id:'clb', name:'Đồ dùng CLB', short:'Đồ dùng CLB', hint:'Tiếp lửa những đam mê', image:'sports' },
  { id:'phu-kien', name:'Phụ kiện học đường', short:'Phụ kiện', hint:'Nhỏ xinh mà hữu ích', image:'pencil-case' }
];
export const schools = ['THPT Chuyên Trần Đại Nghĩa','THPT Nguyễn Thị Minh Khai','THPT Lê Quý Đôn','THPT Trần Phú'];
export const conditions = ['Như mới','Còn tốt','Có ghi chú'];
export const popularSearches = [
  'Sách Toán 12','Máy tính Casio','Áo đồng phục trắng','Vợt cầu lông',
  'Balo đi học','Bộ thước compa','Sổ tay học tập','Bình giữ nhiệt',
  'Flashcard tiếng Anh','Bộ màu nước','Đèn học LED','Áo khoác đồng phục','Đồ dưới 50.000đ'
];
export const sampleSellers = [
  { id:'gia-huy', name:'Gia Huy', shop:'Góc nhỏ của Huy', school:schools[1], verified:true, bio:'Mình thích giữ đồ cẩn thận và tìm người cần chúng hơn.', sample:true, completed:15 },
  { id:'minh-anh', name:'Minh Anh', shop:'Kệ sách của Minh Anh', school:schools[2], verified:true, bio:'Một góc nhỏ cho những cuốn sách đã đi cùng mình.', sample:true, completed:8 },
  { id:'khanh-linh', name:'Khánh Linh', shop:'Góc CLB của Linh', school:schools[3], verified:true, bio:'Chia sẻ những món đồ còn tốt cho hoạt động câu lạc bộ.', sample:true, completed:5 },
  { id:'thu-ha', name:'Thu Hà', shop:'Đồ học của Hà', school:schools[0], verified:true, bio:'Mình có sách, đồ học và vài món dùng trong câu lạc bộ.', sample:true, completed:3 }
];
export const sampleReviews = [
  { id:'sample-review-1', seller:'gia-huy', author:'Minh Anh', label:'Lớp 12 · THPT Lê Quý Đôn', rating:5, text:'Bạn mô tả tình trạng khá kỹ, trả lời nhanh. Mình được xem và kiểm tra đồ trước khi nhận.' },
  { id:'sample-review-2', seller:'minh-anh', author:'Gia Huy', label:'Lớp 11 · THPT Nguyễn Thị Minh Khai', rating:5, text:'Tìm được bộ sách ôn thi vừa túi tiền. Những ghi chú của bạn khóa trên còn giúp mình học tốt hơn!' },
  { id:'sample-review-3', seller:'khanh-linh', author:'Khánh Linh', label:'Lớp 10 · THPT Trần Phú', rating:5, text:'Có thông tin tình trạng và đánh giá giao dịch nên mình dễ cân nhắc trước khi nhắn cho người bán.' }
];
const products = [
  ['may-tinh-khoa-hoc','Máy tính khoa học','dung-cu','Còn tốt',185000,'gia-huy',['calculator','calculator-2'],'Mua để dùng học Toán, Lý và ôn thi. Máy hoạt động bình thường, các phím còn nhạy và màn hình hiển thị rõ. Có vài vết xước nhẹ do sử dụng. Có thể kiểm tra máy trước khi nhận.','casio máy tính fx'],
  ['bo-sach-va-so-tay','Bộ sách & sổ tay học tập','sach','Có ghi chú',65000,'minh-anh',['books'],'Một bộ sách ôn Toán và sổ tay dành cho mùa thi. Sách còn đủ trang, có một vài ghi chú bằng bút chì.','toán 12 sách giáo khoa tài liệu'],
  ['ao-dong-phuc-trang','Áo đồng phục trắng · size M','dong-phuc','Như mới',50000,'gia-huy',['uniform'],'Áo trắng viền xanh size M, giặt sạch và còn nguyên cúc. Có thể xem kích cỡ trước khi nhận.','váy áo lớp'],
  ['bo-dung-cu-clb-the-thao','Bộ dụng cụ CLB thể thao','clb','Còn tốt',90000,'khanh-linh',['sports'],'Bóng rổ và vợt cầu lông đã dùng trong CLB. Vẫn dùng tốt để tập sau giờ học.','ngoại khóa bóng rổ cầu lông'],
  ['tui-but-canvas-xanh-sage','Túi bút canvas xanh sage','phu-kien','Còn tốt',35000,'gia-huy',['pencil-case'],'Túi vải canvas khóa kéo, có thể đựng bút và thước nhỏ. Đã giặt sạch.','bút chì văn phòng phẩm'],
  ['sach-on-tap-toan-12','Sách ôn tập Toán 12','sach','Có ghi chú',45000,'thu-ha',['catalog/math-review'],'Sách ôn thi có phần đại số và hình học. Một số bài đã có lời giải viết chì.','sách toán 12'],
  ['flashcard-tieng-anh','Flashcard tiếng Anh','sach','Như mới',30000,'minh-anh',['catalog/flashcards'],'Bộ thẻ từ vựng tiếng Anh nhiều màu có khoen, dễ phân nhóm theo chủ đề.','thẻ từ vựng'],
  ['bai-tap-hoa-hoc-12','Sách bài tập Hóa học 12','sach','Còn tốt',39000,'thu-ha',['catalog/chemistry'],'Sách bài tập có đáp án cuối sách. Bìa hơi sờn nhưng trang bên trong sạch.','hóa 12 bài tập hóa'],
  ['bo-thuoc-compa','Bộ thước compa','dung-cu','Còn tốt',29000,'thu-ha',['catalog/geometry'],'Có thước thẳng, ê ke, thước đo góc và compa trong hộp nhựa.','dụng cụ hình học'],
  ['so-tay-lo-xo-a4','Sổ tay lò xo A4','dung-cu','Có ghi chú',25000,'minh-anh',['catalog/notebook'],'Sổ xanh bìa cứng, còn nhiều trang trống. Tặng kèm một bút chì kim.','vở sổ tay học tập'],
  ['may-tinh-khoa-hoc-trang','Máy tính khoa học màu trắng','dung-cu','Còn tốt',175000,'thu-ha',['catalog/white-calculator'],'Máy dùng để học Toán và Lý. Phím số và màn hình hoạt động bình thường.','máy tính casio'],
  ['ao-so-mi-trang-l','Áo sơ mi trắng · size L','dong-phuc','Như mới',55000,'thu-ha',['catalog/white-shirt'],'Áo sơ mi tay ngắn, size L. Cổ và tay áo còn sạch, cúc đầy đủ.','áo đồng phục trắng'],
  ['ao-the-thao-xanh-m','Áo thể thao xanh navy · size M','dong-phuc','Còn tốt',40000,'khanh-linh',['catalog/sports-shirt'],'Áo thể dục vải thoáng, có sọc trắng trên vai. Vải còn co giãn tốt.','áo tập đồng phục thể thao'],
  ['ao-khoac-dong-phuc','Áo khoác đồng phục xám','dong-phuc','Còn tốt',85000,'gia-huy',['catalog/jacket'],'Áo khoác nhẹ có khóa kéo, size M. Hợp mặc sáng sớm hoặc trong phòng lạnh.','áo zip áo khoác đi học'],
  ['dan-ukulele','Đàn ukulele gỗ','clb','Còn tốt',280000,'khanh-linh',['catalog/ukulele'],'Ukulele bốn dây dùng tập ở câu lạc bộ, có vài vết sờn nhẹ ở mặt gỗ.','nhạc cụ đàn nhỏ'],
  ['vot-cau-long','Vợt cầu lông kèm quả cầu','clb','Còn tốt',95000,'thu-ha',['catalog/badminton'],'Vợt cũ dây còn căng, cán quấn chắc. Kèm ba quả cầu để tập.','đồ thể thao vợt cầu lông'],
  ['bo-mau-nuoc','Bộ màu nước và hai cọ','clb','Có ghi chú',49000,'khanh-linh',['catalog/watercolors'],'Hộp màu có vài ô đã dùng. Hai cọ gỗ còn mềm và dùng tốt.','màu nước hội họa'],
  ['balo-xanh-olive','Balo đi học xanh olive','phu-kien','Còn tốt',110000,'gia-huy',['catalog/backpack'],'Balo có hai ngăn lớn, khóa kéo còn tốt. Bên ngoài có vết sờn do sử dụng.','ba lô cặp sách'],
  ['binh-giu-nhiet-xanh','Bình giữ nhiệt xanh navy','phu-kien','Có ghi chú',60000,'thu-ha',['catalog/bottle'],'Bình inox có quai ở nắp. Mặt ngoài hơi xước, nắp đóng kín.','bình nước mang đi học'],
  ['day-deo-the','Dây đeo thẻ và bao thẻ','phu-kien','Như mới',18000,'minh-anh',['catalog/lanyard'],'Dây vải xanh đậm và bao nhựa trong để đựng thẻ.','phụ kiện thẻ học sinh'],
  ['tui-tote-navy','Túi tote xanh navy','phu-kien','Còn tốt',42000,'thu-ha',['catalog/tote'],'Túi vải quai dài, đựng vừa sách A4 và sổ tay. Đường may còn chắc.','túi canvas quai dài'],
  ['bong-ro-cu','Bóng rổ tập luyện','clb','Có ghi chú',70000,'khanh-linh',['catalog/basketball'],'Bóng tập sân ngoài trời còn giữ hơi. Bề mặt có dấu mòn do sử dụng.','bóng rổ basketball'],
  ['den-hoc-led','Đèn học LED để bàn','dung-cu','Còn tốt',120000,'gia-huy',['catalog/desk-light'],'Đèn bàn ánh sáng ấm, cổ đèn điều chỉnh được và chân đế chắc.','đèn học đèn bàn led']
];
export const sampleListings = products.map(([id,title,category,condition,price,sellerId,images,description,keywords]) => {
  const seller=sampleSellers.find(person=>person.id===sellerId);
  return {id,title,category,condition,price,sellerId,seller:seller.name,school:seller.school,verified:true,
    images:images.map(image=>'/assets/'+image+'.jpg'),description,keywords,tags:inferredTags(category,title,keywords,description),
    delivery:'Hẹn tại khu vực công cộng gần trường.',sample:true,status:'active'};
});

