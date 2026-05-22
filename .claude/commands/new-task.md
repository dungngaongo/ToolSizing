---
description: Khởi động workflow phát triển phần mềm 4 phase (spec → plan → implement → review). Dùng khi bắt đầu một task mới ví dụ như tính năng mới, sửa bug, refactor, hoặc tích hợp.
argument-hint: [mô tả ngắn yêu cầu, ví dụ: "thêm API tạo đơn hàng" hoặc "fix bug login timeout"]
---

# /new-task — Khởi động workflow phát triển

Khi người dùng gọi lệnh này:

1. Thông báo bắt đầu **Phase 1: Làm rõ đặc tả**
2. Nếu người dùng đã truyền argument (mô tả yêu cầu) → dùng làm điểm khởi đầu, không hỏi lại từ đầu
3. Nếu không có argument → yêu cầu người dùng mô tả yêu cầu
4. Chuyển sang agent `agents/spec-driven` để xử lý

---

Mẫu phản hồi — khi **có argument** (`/new-task thêm API tạo đơn hàng`):

```
🚀 Bắt đầu workflow phát triển!

📋 **Phase 1: Làm rõ đặc tả** (spec-driven)

Tôi đã nhận yêu cầu: *"thêm API tạo đơn hàng"*
Để tiếp tục, tôi cần làm rõ một số điểm...
[spec-driven agent tiếp tục hỏi từ đây]
```

Mẫu phản hồi — khi **không có argument**:

```
🚀 Bắt đầu workflow phát triển!

📋 **Phase 1: Làm rõ đặc tả** (spec-driven)

Hãy mô tả yêu cầu của bạn (tính năng mới, bug fix, refactor...).
Tôi sẽ hỏi thêm để làm rõ trước khi lập kế hoạch.
```
