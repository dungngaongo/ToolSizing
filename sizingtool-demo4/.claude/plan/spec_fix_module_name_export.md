# Đặc tả: Fix hiển thị tên module khi export DOCX

## Yêu cầu
Sửa tiêu đề các section trong phần "IV. ĐỊNH CỠ HỆ THỐNG" khi export file DOCX.

## Hiện tại
- File: `backend1/src/main/java/com/example/sizing/service/ExportService.java` (dòng 391)
- Code: `String heading = sectionIndex + ". Module " + moduleType;`
- Kết quả: "1. Module App", "2. Module MariaDB", "3. Module Redis"...

## Mong muốn
- Hiển thị: "1. Module [Tên_Module_Cụ_Thể]"
- Ví dụ: Nếu tên module là "OrderService" → "1. Module OrderService"
- Điều kiện: Tên module luôn có giá trị (không được phép để trống)

## Phạm vi
- Chỉ sửa tiêu đề section chính trong phần "IV. ĐỊNH CỠ HỆ THỐNG"
- Không thay đổi các phần khác của file DOCX

## Ràng buộc
- Sử dụng trường `module.getName()` thay vì `moduleType`
- Giữ nguyên định dạng số thứ tự section (1., 2., 3...)