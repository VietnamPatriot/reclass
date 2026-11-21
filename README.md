# RE:CLASS

RE:CLASS là chợ trao đổi đồ học đường dành cho học sinh THPT. Trang chủ và trang chi tiết được dựng từ bản thiết kế Figma. Tin, ảnh và đánh giá minh họa có nhãn riêng.

## Chạy thử trên máy

Cần Node.js 24 trở lên.

```powershell
Set-Location 'C:\ytkn\reclass'
npm.cmd ci
npm.cmd run dev
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173). Nút **Đăng nhập** cho phép chọn người bán, người mua hoặc người kiểm duyệt bằng tài khoản thử nghiệm. Dữ liệu thử được lưu trong `.local/`.

1. Người bán thử gửi một tin có ảnh. Tin chờ duyệt sẽ xuất hiện trong **Tài khoản** của người bán.
2. Kiểm duyệt thử chọn **Tài khoản → Bảng kiểm duyệt**, xét duyệt tin và tạo mã xác minh dùng một lần cho trường tương ứng.
3. Người mua thử nhập mã tại **Tài khoản → Nhập mã xác minh**, rồi mở tin đã duyệt để trao đổi.
4. Mỗi bên xác nhận trong giao dịch của mình. Sau xác nhận của cả hai, người mua có thể gửi đánh giá.

## Bản triển khai riêng tư

Sites cung cấp đăng nhập ChatGPT. Worker lưu dữ liệu thị trường trong D1, ảnh trong R2. Vai trò kiểm duyệt được kích hoạt một lần cho tài khoản đầu mối bằng biến môi trường bí mật `MODERATOR_CODE`. Không đưa mã quản trị vào mã nguồn. Bảng kiểm duyệt cấp mã xác minh học sinh dùng một lần theo trường. Việc cấp mã thực tế cần đầu mối được trường chấp thuận.

Chạy `npm.cmd run build` để tạo Worker trong `dist/server/index.js`. Tệp di trú D1 nằm trong `drizzle/`.

