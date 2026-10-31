# PaperNote 2.4.1 cho Windows

Bản 2.4.1 thay 31 biểu tượng bằng SVG lấy từ các tài nguyên giao diện của Goodnotes đã cài trên máy, gồm bút, tẩy, lasso, chữ, hình, ảnh, thước và các nút điều hướng. Giữ nguyên tọa độ hình gốc và chuyển trạng thái viền trắng/màu bằng kiểu hiển thị. Nguồn và mã kiểm tra hình học có trong `web/icons/goodnotes/sources.json`. Đây là thay đổi biểu tượng, không thay đổi bộ máy viết hoặc dữ liệu sổ.

## Giao diện theo ảnh tham chiếu

Màn hình viết dùng hai thanh xanh, tab sổ phía trên, thanh công cụ ở giữa, bảng ngòi/độ dày/màu đen nổi và cụm hoàn tác bên trái. Các chức năng bút, lớp, bảng thử bút, tìm kiếm, xuất và sao lưu vẫn có trên thanh công cụ hoặc menu dấu ba chấm. Kiểu nét liền/đứt/chấm nằm trong Cài đặt bút. Danh sách trang mặc định thu gọn; nút bên trái thanh công cụ mở lại.

Bấm **+ ở hàng tab** để tạo bảng trắng chấm bi rộng. Hoặc chọn **Bảng trắng rộng, nền chấm bi** khi tạo sổ mới. Bảng trắng có kích thước hữu hạn, có thể cuộn; không thay khổ giấy hay nội dung các sổ cũ.

Con trỏ tròn có màu mực và viền đen. Đường kính bằng độ dày cơ bản đã chọn nhân mức thu phóng. Đánh dấu/băng che dùng độ rộng tương ứng; tẩy dùng hai lần bán kính tẩy. Con trỏ được vẽ ngoài trang nên không vào PNG, PDF hoặc bản sao lưu. Cỡ thực của nét bút máy/cọ vẫn biến thiên theo lực nhấn như trước. GeoGebra đang tạm bỏ qua theo yêu cầu; chưa có nút mở trong bản này.

## Đồng bộ lên Google Drive

Trong **Cài đặt & sao lưu → Google Drive → Kết nối**, nhập OAuth Client ID loại **Desktop app** và Client secret của bạn, rồi bấm **Đăng nhập Google**. Trình duyệt mở trang đăng nhập Google, sau đó trả quyền về PaperNote qua địa chỉ loopback trên máy. Bật Google Drive API và quyền `https://www.googleapis.com/auth/drive.file` trong cùng dự án Google Cloud. Nếu dự án ở chế độ Testing, thêm email của bạn vào Test users. Nút Hướng dẫn kết nối trong ứng dụng có các bước này. Dùng cùng Client ID trên các máy để thấy các bản sao của nhau.

Sau khi kết nối, PaperNote tự tải thư viện đã lưu lên thư mục **PaperNote** trong My Drive. Mỗi máy sở hữu một tệp `.papernote` riêng. Kiểm tra mỗi 30 giây khi ứng dụng mở, chờ ít nhất 5 giây sau lần lưu cuối; tự thử lại khi lỗi mạng, kể cả sau khi đóng và mở lại ứng dụng. Thay đổi phát sinh trong lúc tải sẽ còn chờ cho lượt tiếp theo. Có nút Đồng bộ ngay và thời gian xác nhận tải lên. Việc lưu trên máy không đợi Drive.

**Khôi phục từ Drive** nhập thêm các sổ vào thư viện đang có. Đây là đồng bộ bản sao lên Drive, chưa tự tải xuống hoặc gộp chỉnh sửa giữa các máy. Một bản thư viện tối đa 512 MB; nhập tệp PDF/backup từ đĩa vẫn giữ giới hạn 150 MB. Chỉ đồng bộ khi PaperNote đang mở. Token và thông tin kết nối được Windows DPAPI mã hóa cho tài khoản Windows hiện tại, không đi vào bản sao ghi chú. Ngắt kết nối xóa thông tin trên máy và thử thu hồi quyền Google; sổ và tệp Drive được giữ nguyên.

Tài liệu Google: [OAuth cho Desktop app](https://developers.google.com/identity/protocols/oauth2/native-app), [quyền truy cập tệp do ứng dụng tạo](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Bản ứng dụng ghi chú độc lập lấy cảm hứng từ Goodnotes, được viết mới dựa trên các luồng sử dụng công khai. Ảnh đầu vào chỉ chứa biểu tượng ứng dụng nên giao diện được tái dựng theo phong cách thư viện sổ và trang viết, không phải bản sao chính xác từng màn hình.

## Bản sửa nét 2.1

Lấy mẫu theo khoảng cách để bút có tốc độ lấy mẫu khác nhau vẫn cho đường nét nhất quán; lọc rung và lực nhấn bằng cửa sổ đối xứng; vẽ đường cong liên tục thay cho nối đoạn có góc; đầu nét chỉ tô một lần; bỏ dao động giả ở viền bút chì. Gom vẽ màn hình theo khung hình và giữ điểm cuối khi nhấc bút. Dữ liệu điểm gốc trong sổ vẫn được giữ nguyên. Bài thử mô phỏng cùng đầu vào xác nhận giảm rung, không thay thế kiểm tra bảng vẽ thực.

## Cài đặt

Chạy `dist/PaperNote-Setup.exe`, chọn Cài đặt. Bộ cài theo tài khoản hiện tại, tạo lối tắt Desktop và Start Menu, đăng ký mục gỡ trong Cài đặt Windows. Không cần quyền quản trị. Có thể chạy bản portable `dist/PaperNote/PaperNote.exe` cùng thư mục đi kèm.

Yêu cầu Windows 10/11 64-bit, .NET Framework 4.7.2 trở lên và Microsoft Edge WebView2 Runtime. WebView2 đã có trên máy phát triển; bộ cài không tải và cài runtime. Nếu thiếu, tải runtime từ https://developer.microsoft.com/microsoft-edge/webview2/. Ứng dụng chưa ký số.

## Chức năng

- Thư viện sổ: tạo, đổi tên, nhân bản, thư mục, yêu thích, tìm nội dung đã gõ, dạng lưới/danh sách, thùng rác và khôi phục.
- Bút máy, bút bi, bút cọ, bút chì; nét liền/đứt/chấm; độ dày, độ nhạy lực, đường lực nhấn, độ nhọn, độ dẹt và ổn định nét. Bút bi có nét đều; các kiểu còn lại có đường dựng nét riêng.
- Đánh dấu một đường trong suốt liên tục, không tối thêm ở mỗi điểm nối; tùy chọn kẻ thẳng.
- Tẩy toàn nét hoặc tẩy chính xác từng phần; lọc bút mực/chì/đánh dấu/băng che, tự trở lại công cụ trước, hoàn tác/làm lại. Tẩy chỉ áp dụng nét tự do; hình vẽ, ảnh và chữ dùng lasso để xóa.
- Lasso tự do hoặc hình chữ nhật; cắt/sao chép/dán giữa các sổ trong ứng dụng, đổi màu/cỡ, thu phóng, xoay, đưa trước/sau; di chuyển bằng bàn phím.
- Bộ sưu tập vùng chọn dùng lại, giấy ghi chú, băng che chạm để ẩn/hiện, laser tạm thời, thước theo góc.
- Tạo lớp, khóa/ẩn lớp, đánh dấu/lọc trang, chế độ chỉ đọc, nhiều tab sổ, tìm chữ trong sổ/PDF.
- Bảng thử bút: loại thiết bị, mẫu lực nhấn thực nhận, min/max, độ nghiêng X/Y, chỉnh đường lực nhấn. Nhận dữ liệu qua Windows Ink/Pointer Events; chưa dùng Wintab và chưa mô phỏng ngòi nghiêng. Phần cứng thực cần kiểm tra với thiết bị của người dùng.
- Gõ chữ nhiều dòng, chọn phông/cỡ, đậm/nghiêng; nhấp đúp để sửa. Delete để xóa vùng chọn.
- Cắt ảnh theo bốn cạnh, giữ ảnh gốc để khôi phục; xuất trang PNG.
- Hình chữ nhật, elip, tam giác, đường thẳng, mũi tên; tô màu; giữ Shift vẽ vuông/tròn. Vẽ rồi giữ nhận dạng đường thẳng, chữ nhật và elip. Chèn PNG/JPEG/WebP.
- Thêm, nhân bản, sắp xếp, xóa trang; giấy kẻ dòng, ô vuông, chấm bi, giấy trắng, Cornell, khuông nhạc, kế hoạch; màu giấy và khổ A4 dọc/ngang, Letter, vuông; thu phóng và kéo trang.
- Nhập PDF (tối đa 150 trang, 150 MB), viết lên nền PDF và xuất PDF của toàn bộ sổ. PDF nhập mới giữ bytes PDF gốc, chữ để tìm và liên kết nội bộ/ngoài (mở ở chế độ chỉ đọc). Xuất lại bằng cách sao chép trang PDF gốc và đặt lớp ghi chú lên trên, giữ lớp chữ gốc. Nét/chữ ghi chú mới được xuất dưới dạng lớp ảnh; chưa phải vector hay chữ có thể chọn. PDF đã nhập bằng bản 1.0 chỉ còn nền ảnh, cần nhập lại tệp gốc để có lớp chữ. Biểu mẫu, bookmark PDF và mọi loại liên kết chưa được đảm bảo giữ nguyên sau sắp xếp/nhân bản trang.
- Xuất sổ/thư viện dưới dạng `.papernote`, khôi phục bằng cách nhập thêm, giữ các sổ hiện tại.
- Dữ liệu ngoại tuyến trong `%LOCALAPPDATA%\PaperNote\Data`, gồm IndexedDB trong `WebView2` và bản phục hồi `library.json`, `library.json.previous`. Khi nâng từ 1.0, bản gốc được giữ trong `library.json.before-2` và một bản trong IndexedDB. Ứng dụng chỉ báo đã lưu sau khi cả hai nơi xác nhận.

Không có đồng bộ Goodnotes/iCloud, AI, OCR/nhận dạng chữ viết, ghi âm hoặc cộng tác trực tuyến. Không đọc định dạng `.goodnotes` độc quyền. Các chức năng ghi chú hoạt động cục bộ, không cần tài khoản; kết nối Google chỉ dùng cho phần Drive tùy chọn.

## Phím tắt

P: bút, H: đánh dấu, E: tẩy, L: chọn, S: hình, T: chữ, V: kéo trang. Ctrl+Z/Y: hoàn tác/làm lại. Ctrl+N: sổ mới. Ctrl+Enter: trang mới. Ctrl+S: lưu. Alt+mũi tên trái/phải: chuyển trang.

## Mã nguồn và đóng gói

`web/main.js`, `web/app.css`: giao diện và chức năng; `native/Host.cs`: cửa sổ Windows, lưu trữ và xuất tệp; `native/Setup.cs`: bộ cài/gỡ. `build-windows.ps1` tạo bản portable và bộ cài, dùng thư viện PDF và WebView2 đi kèm. `build.cjs` đọc thư viện PDF từ biến môi trường `PAPERNOTE_DEPENDENCIES` hoặc runtime được cấu hình trên máy phát triển. Giấy phép bên thứ ba có trong `web/licenses/`.

Tài liệu tham chiếu: https://support.goodnotes.com/hc/en-us/articles/7378598719759-Get-Started-With-Goodnotes-for-Android-Windows-and-Web và https://learn.microsoft.com/en-us/microsoft-edge/webview2/get-started/winforms.

## Đối chiếu và giới hạn

Các kiểu bút và thao tác được viết mới dựa trên tài liệu Goodnotes công khai, không dùng bộ dựng nét hay mã nguồn Goodnotes. Không có cơ sở để cam kết độ giống 100%. Chưa có đối chiếu nét từng pixel hoặc đo độ trễ trên bảng vẽ Wacom/Huion/XP-Pen thực. Chưa có scribble-to-erase, reflow chữ viết tay, tilt shading, công cụ zoom-writing độc lập, cuộn nhiều trang liên tục, ghi âm hay nhận dạng chữ viết. Các công cụ quản lý/chỉnh sửa ở trên đã được kiểm tra; danh sách này không tuyên bố đầy đủ tính năng Goodnotes.

AI và dịch vụ cloud không được thêm theo xác nhận của người dùng. Không có kết nối tới Goodnotes Account.

Nếu bút chỉ báo Chuột trong khung thử, kiểm tra Windows Ink của driver. Hướng dẫn hãng: https://support.huion.com/en/support/solutions/articles/44002618549-what-to-do-if-the-pen-pressure-function-is-not-available-on-the-application và https://developer-support.wacom.com/hc/en-us/articles/12844630619415-Windows-Ink.

## Bộ cài 2.1.1

Sửa lỗi Exception has been thrown by the target of an invocation khi tạo lối tắt gỡ cài đặt: tệp lối tắt nay dùng tên Uninstall PaperNote.lnk để tương thích Windows Script Host/.NET Framework. Bản sửa không thay đổi bộ dựng nét 2.1 hoặc định dạng sổ. Các bước chép ứng dụng, tạo ba lối tắt và đăng ký trong Cài đặt Windows đã được kiểm tra thực tế. Chạy npm run test:installer để kiểm tra lại trong thư mục thử riêng.


## Bản 2.2 — giao diện và con trỏ

Ctrl + dấu cộng (hoặc Ctrl + dấu bằng) phóng to trang; Ctrl + dấu trừ thu nhỏ. Hỗ trợ dấu cộng/trừ bàn phím số và giới hạn thu/phóng hiện có. Phím này không can thiệp khi đang nhập chữ hoặc trong hộp thoại.

Con trỏ viết là một chấm tròn theo màu mực đang chọn, viền đen với mép trắng giúp nhìn rõ trên nền tối. Bàn tay/chữ/lasso giữ con trỏ phù hợp; tẩy dùng vòng tròn rỗng. Con trỏ không được vẽ vào trang hoặc PDF.

Bộ icon công cụ được vẽ lại bằng vector nét tròn đồng nhất. Nút, thanh công cụ, thư viện, ô nhập và hộp thoại có hệ bo góc thống nhất. Bốn kiểu bút có icon riêng. Các tính năng nét viết, dữ liệu sổ và bộ cài giữ hành vi đã kiểm tra.
