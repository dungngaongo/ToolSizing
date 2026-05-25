# Kế hoạch tách sizing Disk theo phân vùng cho Module App

## Tóm tắt
- Giữ `Disk (GB)` ở bảng `Thông tin hệ thống tham chiếu` của App chỉ để tham chiếu, nhưng loại nó khỏi toàn bộ logic sizing App.
- Ở bảng `THÔNG TIN TẢI ĐẦU VÀO`, bỏ 2 cột `Tải Disk` và `Disk Used`; chỉ còn CPU/RAM load và các giá trị `Cint used`, `RAM used`.
- Thêm ngay bên dưới một bảng mới `THÔNG TIN LƯU TRỮ ĐẦU VÀO` với các cột: `IP`, `Phân vùng`, `Used`, `Ghi chú`, `Đánh giá`, `Ghi chú (Admin)`, có nút `Thêm Server Tham chiếu`.
- Sizing App sẽ lấy `Used` của từng phân vùng làm đầu vào thủ công, gom nhóm theo tên phân vùng, rồi áp dụng đúng công thức disk cũ cho từng phân vùng riêng lẻ.
- Không có thay đổi schema DB vật lý; dữ liệu vẫn lưu trong JSON của `dinhCoHeThongContent` và `dinhCoAdminReview`, nhưng contract JSON của `moduleApp` được mở rộng.

## Thay đổi giao diện và contract dữ liệu
- Cập nhật UI App trong [C:\Users\Admin\Downloads\sizing\frontend\index.html](/C:/Users/Admin/Downloads/sizing/frontend/index.html) và logic tương ứng trong [C:\Users\Admin\Downloads\sizing\frontend\script.js](/C:/Users/Admin/Downloads/sizing/frontend/script.js).
- Giữ `baselineTable` như hiện tại, nhưng `disk` không còn tham gia `updateBaselineTotal`, `recalculateInputConfigForRow`, `calculateSizingRecommendations`, `parseAppSizingResult`, summary và export.
- Thu gọn `inputConfigTable` của App cho save/load mới thành các field:
  `ip`, `cpuLoad`, `ramLoad`, `cintUsed`, `ramUsed`, `adminEval`, `adminNote`, `evidenceImage(s)` nếu đang có.
- Thêm collection mới trong `moduleApp`:
  `storageInputTable: [{ stt, ip, partition, used, note, adminEval, adminNote }]`
- Thêm review riêng trong `dinhCoAdminReview.moduleApp`:
  `storageRowReviews: [{ eval, note }]`
- Tương thích ngược khi load dữ liệu cũ:
  - nếu `inputConfigTable` còn `diskLoad`/`diskUsed` thì bỏ qua trên UI mới;
  - nếu chưa có `storageInputTable` thì bảng mới khởi tạo rỗng;
  - nếu `sizingResult` cũ vẫn còn dạng `DISK` đơn, parser summary vẫn fallback đọc được.

## Thay đổi xử lý nghiệp vụ
- Bỏ toàn bộ phụ thuộc App vào các selector/ID/class sau: `disk-load-input`, `disk-used-input`, `total-disk-used`, và các đoạn cộng/tính disk trong App input table.
- Thêm bảng lưu trữ mới với đầy đủ thao tác: thêm dòng, xóa dòng, đánh lại STT, save/load, apply role permissions, admin review load/save, diff history.
- Công thức mới cho storage:
  - Tổng `Used` hiện tại được gom theo `partition` sau khi cộng tất cả dòng cùng tên phân vùng.
  - Với mỗi phân vùng:
    - `partitionForTPS = totalUsedByPartition * factor`
    - `partitionAfterKPI = partitionForTPS / 0.8 * 1.1`
    - `partitionPerServer = ceil(partitionAfterKPI / N)`
- `Bảng tính toán Máy chủ Tiến trình` của App:
  - giữ các dòng CPU/RAM như cũ;
  - thay 2 dòng disk cũ bằng các dòng động theo từng phân vùng, ví dụ:
    - `/os (GB) cần cho hệ thống`
    - `/os cần sau khi nhân hệ số dự phòng và đảm bảo KPI`
    - `/u01 ...`
  - ghi chú công thức của từng dòng dùng đúng format disk cũ nhưng thay `totalDisk` bằng `totalUsedByPartition`.
- `Bảng phân bổ theo số lượng N`:
  - bỏ cột `Disk yêu cầu`;
  - thay bằng các cột động theo từng phân vùng, mỗi cột hiển thị `partitionAfterKPI / N`.
- `Đề xuất cấu hình`:
  - bỏ bullet `DISK: = ... GB`;
  - thay bằng nhiều bullet theo phân vùng, ví dụ `/os: = 120 GB`, `/u01: = 300 GB`.
- `parseAppSizingResult` và `aggregateSizingResults`:
  - không hardcode `DISK`;
  - parse danh sách partition từ HTML kết quả App một cách tổng quát;
  - summary row của App hiển thị CPU, RAM và toàn bộ phân vùng theo từng dòng.

## Thay đổi export DOCX
- Cập nhật [C:\Users\Admin\Downloads\sizing\backend1\src\main\java\com\example\sizing\service\ExportService.java](/C:/Users/Admin/Downloads/sizing/backend1/src/main/java/com/example/sizing/service/ExportService.java).
- `writeModuleApp`:
  - bảng `Thông tin tải đầu vào` bỏ 2 cột `Tải DISK` và `DISK used`;
  - thêm bảng `Thông tin lưu trữ đầu vào` mới, export đúng các cột `IP`, `Phân vùng`, `Used`, `Ghi chú`, `Đánh giá`, `Ghi chú (Admin)`.
- `parseAndWriteAppSizingResult`:
  - bỏ regex cố định cho `DISK`;
  - parse bảng App sizing theo cấu trúc HTML thực tế để hỗ trợ số lượng phân vùng động;
  - bảng `Bảng phân bổ theo số lượng N` và `Đề xuất thiết bị` cũng phải ghi ra đúng danh sách phân vùng thay vì 1 disk tổng.
- Phần `Tổng hợp và đề xuất` không cần đổi schema riêng; chỉ cần để `cauHinh` của App sau parse mới chứa các dòng phân vùng và export xuống DOCX như text nhiều dòng.

## Kiểm thử và nghiệm thu
- Save/load App mới:
  - lưu và mở lại được `storageInputTable`, `inputConfigTable` mới, review admin, và `sizingResult`.
- Tính toán:
  - case 1 phân vùng;
  - case nhiều phân vùng khác nhau;
  - case nhiều dòng cùng một phân vùng trên nhiều IP, bảo đảm cộng gộp đúng theo tên phân vùng;
  - case không có dòng storage thì App không tính kết quả và báo thiếu dữ liệu.
- Tương thích dữ liệu cũ:
  - project cũ có `diskLoad`/`diskUsed` vẫn load được;
  - project cũ có `sizingResult` dạng `DISK` đơn vẫn aggregate summary không lỗi.
- Review/diff:
  - màn so sánh lịch sử không còn hiện `Disk Load`/`Disk Used` trong App input;
  - có block diff riêng cho `Thông tin lưu trữ đầu vào`.
- Export DOCX:
  - bảng App export đúng cấu trúc mới;
  - kết quả sizing và đề xuất cấu hình hiển thị đủ các phân vùng động.

## Giả định đã khóa
- `Disk (GB)` ở bảng tham chiếu App vẫn giữ để nhìn tham chiếu, nhưng không còn được dùng trong bất kỳ phép tính sizing App nào.
- `Used` trong bảng `THÔNG TIN LƯU TRỮ ĐẦU VÀO` là giá trị nhập tay, không tự tính từ `% load`.
- Tên phân vùng được xem là key gom nhóm logic; các dòng cùng `partition` sẽ cộng `Used` trước khi áp công thức sizing.
- Không thêm cột ảnh sở cứ cho bảng lưu trữ mới vì yêu cầu hiện tại không nêu cần lưu evidence cho bảng này.
