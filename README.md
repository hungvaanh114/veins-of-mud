# Veins of Mud

Game chiến hào 2D nhìn thẳng từ trên xuống, viết bằng JavaScript và HTML Canvas. Bản tải về dùng mã game từ commit `5de1829e742908c2beac2d712ffa0e372d58373c`.

## Chơi trên web

**[Mở game Veins of Mud](https://hungvaanh114.github.io/veins-of-mud/)**

Người chơi chỉ cần mở đường dẫn trên bằng trình duyệt, không cần tải game hay đăng nhập GitHub. Máy tính dùng bàn phím và chuột; điện thoại có nút di chuyển, bắn và trèo trên màn hình. Bấm **Bật âm thanh** để nghe âm thanh trong game.

## Xuất bản bằng GitHub Pages

Repository: https://github.com/hungvaanh114/veins-of-mud

Nhánh `main` lưu toàn bộ mã nguồn. Nhánh `gh-pages` chỉ chứa nội dung `dist/` và được GitHub Pages phục vụ trực tiếp. Game dùng đường dẫn tài nguyên tương đối nên chạy được dưới đường dẫn `/veins-of-mud/`.

Trong **Settings → Pages → Build and deployment → Source**, chọn **Deploy from a branch**, nhánh **gh-pages**, thư mục **/(root)**. Xem tiến trình ở tab **Actions**; khi xuất bản thành công, dùng đường dẫn chơi game ở trên.

Để cập nhật sau khi sửa game:

```powershell
git add dist art tools README.md .gitignore .gitattributes
git commit -m "Update game"
powershell -ExecutionPolicy Bypass -File tools/publish.ps1
```

Nếu muốn cập nhật cả bản ngoại tuyến, chạy `py tools/build_offline.py` rồi thêm `CHOI-GAME.html` vào commit. Bản web chỉ phát hành nội dung `dist/`.

## Chơi ngay trên Windows

1. Bấm chuột phải vào file ZIP, chọn **Extract All…** (Giải nén tất cả).
2. Vào thư mục vừa giải nén và nhấp đúp **CHOI-GAME.html**. Nếu Windows hỏi ứng dụng, chọn **Microsoft Edge** hoặc **Google Chrome**.

File này chứa toàn bộ mã và hình ảnh để chơi ngoại tuyến. Bạn có thể chép riêng file này sang máy khác.

## Chạy bản dành cho phát triển

Từ thư mục dự án, dùng lệnh sau để phục vụ trực tiếp các file trong `dist/` trên máy có Python 3.

```powershell
py -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Mở http://localhost:8000 và nhấn Ctrl+C trong PowerShell khi muốn dừng. Sau khi sửa mã hoặc hình ảnh, chạy `py tools/build_offline.py` để tạo lại **CHOI-GAME.html**. Trên macOS hoặc Linux, dùng `python3` thay cho `py`.

## Đưa lên Git

Nếu bạn đã clone repository về máy, chép `art/`, `dist/`, `tools/`, `CHOI-GAME.html` và README vào thư mục dự án, kiểm tra thay đổi bằng `git status` rồi commit và push trên nhánh đang dùng.

Nếu bắt đầu từ một repository trống trên GitHub, mở PowerShell ở thư mục chứa README. Thay URL ví dụ bằng URL repository của bạn rồi chạy

```powershell
git init -b main
git add README.md art dist tools CHOI-GAME.html .gitignore .gitattributes
git commit -m "Import Veins of Mud web game"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## Nội dung dự án

- `dist/index.html` là điểm vào của game. Các file JavaScript và CSS trong `dist/` có thể chỉnh sửa trực tiếp. Thư mục này cũng chứa sprite nhân vật, bản đồ va chạm, hiệu ứng và các ô địa hình. Khi triển khai bằng dịch vụ lưu trữ web tĩnh, chọn `dist/` làm thư mục phát hành.
- `art/` chứa dữ liệu bố trí chiến trường, ảnh vật liệu nguồn và các script Python dùng để tạo lại một số texture.

## Điều khiển

Di chuyển bằng WASD hoặc các phím mũi tên, giữ Shift để chạy. Bắn bằng chuột trái hoặc J, trèo lên hay xuống hào bằng phím cách. Nhấn E để tương tác, F để bật hoặc tắt đèn và M để mở bản đồ. Bấm **Bật âm thanh** trong game để nghe tiếng bước chân, động cơ và pháo.

## Ánh sáng và thời tiết

Mục **Ánh sáng** có Trời sáng, Trời tối, Đêm trăng sáng, Trăng mờ và Trăng máu. Mục **Thời tiết** độc lập, gồm Trời quang, Trời mưa, U ám, Sương mù và Tự thay đổi. Thử Trăng mờ cùng Sương mù ở điểm đầu và nhấn F để so sánh vùng nhìn. Bấm Bật âm thanh để nghe hướng của những viên đạn thỉnh thoảng bay sượt qua.
