export const categories = [
  { id:'sach', name:'Sách & tài liệu', short:'Sách & tài liệu', hint:'Góc sách cho mùa thi', image:'books' },
  { id:'dung-cu', name:'Dụng cụ học tập', short:'Dụng cụ học tập', hint:'Từ chiếc bút đến máy tính', image:'calculator' },
  { id:'dong-phuc', name:'Đồng phục & áo lớp', short:'Đồng phục', hint:'Thêm một năm đồng hành', image:'uniform' },
  { id:'clb', name:'Đồ dùng CLB', short:'Đồ dùng CLB', hint:'Tiếp lửa những đam mê', image:'sports' },
  { id:'phu-kien', name:'Phụ kiện học đường', short:'Phụ kiện', hint:'Nhỏ xinh mà hữu ích', image:'pencil-case' }
];
export const schools = ['THPT Chuyên Trần Đại Nghĩa','THPT Nguyễn Thị Minh Khai','THPT Lê Quý Đôn','THPT Trần Phú'];
export const conditions = ['Như mới','Còn tốt','Có ghi chú'];
export const sampleSellers = [
  { id:'gia-huy', name:'Gia Huy', shop:'Góc nhỏ của Huy', school:schools[1], verified:true, bio:'Mình thích giữ đồ cẩn thận và tìm người cần chúng hơn.', sample:true, completed:15 },
  { id:'minh-anh', name:'Minh Anh', shop:'Kệ sách của Minh Anh', school:schools[2], verified:true, bio:'Một góc nhỏ cho những cuốn sách đã đi cùng mình.', sample:true, completed:8 },
  { id:'khanh-linh', name:'Khánh Linh', shop:'Góc CLB của Linh', school:schools[3], verified:true, bio:'Chia sẻ những món đồ còn tốt cho hoạt động câu lạc bộ.', sample:true, completed:5 }
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
  ['tui-but-canvas-xanh-sage','Túi bút canvas xanh sage','phu-kien','Còn tốt',35000,'gia-huy',['pencil-case'],'Túi vải canvas khóa kéo, có thể đựng bút và thước nhỏ. Đã giặt sạch.','bút chì văn phòng phẩm']
];
export const sampleListings = products.map(([id,title,category,condition,price,sellerId,images,description,keywords]) => {
  const seller=sampleSellers.find(person=>person.id===sellerId);
  return {id,title,category,condition,price,sellerId,seller:seller.name,school:seller.school,verified:true,
    images:images.map(image=>'/assets/'+image+'.jpg'),description,keywords,delivery:'Hẹn tại khu vực công cộng gần trường.',sample:true,status:'active'};
});

