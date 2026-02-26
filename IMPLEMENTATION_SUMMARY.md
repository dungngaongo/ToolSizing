# Tính năng: Ẩn/Hiện các Module trong Phần Định Cỡ Hệ Thống

## Mô tả tính năng
Khi người dùng chọn các module ở phần **"3. MÔ HÌNH HỆ THỐNG"** → **"D. Chi tiết thành phần"**, thì phần **"4. ĐỊNH CỠ HỆ THỐNG"** sẽ chỉ hiển thị các module được chọn. Các module khác sẽ bị ẩn đi. Các phần tính toán của các module không thay đổi gì.

## Các thay đổi thực hiện

### 1. Thêm hàm `getSelectedModules()` (script.js)
- **Vị trí**: Sau hàm `addArchRow()`
- **Chức năng**: Lấy danh sách các module được chọn từ bảng "Chi tiết thành phần"
- **Trả về**: Mảng các loại module (App, Redis, MariaDB, Kafka, K8S, LB/FW)

```javascript
function getSelectedModules() {
    const selectedModules = new Set();
    document.querySelectorAll('#arch-table-body tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        const loaiModuleSelect = cells[2]?.querySelector('select');
        const loaiModule = loaiModuleSelect?.value?.trim();
        if (loaiModule) {
            selectedModules.add(loaiModule);
        }
    });
    return Array.from(selectedModules);
}
```

### 2. Thêm hàm `updateModuleVisibility()` (script.js)
- **Vị trí**: Sau hàm `getSelectedModules()`
- **Chức năng**: Cập nhật visibility của các module sections dựa trên các module được chọn
- **Hành động**: 
  - Ẩn toàn bộ wrapper của module không được chọn
  - Hiển thị wrapper của module được chọn

```javascript
function updateModuleVisibility() {
    const selectedModules = getSelectedModules();
    const moduleMapping = {
        'App': 'module-app-content',
        'Redis': 'module-redis-content', 
        'MariaDB': 'module-mariadb-content',
        'Kafka': 'module-kafka-content',
        'K8S': 'module-k8s-content',
        'LB/FW': 'module-lbfw-content'
    };
    
    Object.entries(moduleMapping).forEach(([moduleName, contentId]) => {
        const moduleContent = document.getElementById(contentId);
        const moduleWrapper = moduleContent?.closest('.module-collapsible');
        
        if (moduleWrapper) {
            if (selectedModules.includes(moduleName)) {
                moduleWrapper.style.display = 'block';
            } else {
                moduleWrapper.style.display = 'none';
                moduleContent.classList.remove('expanded');
                const header = moduleContent.previousElementSibling;
                if (header) {
                    header.classList.remove('active');
                }
            }
        }
    });
}
```

### 3. Cập nhật hàm `addArchRow()` (script.js)
- **Thay đổi**: Thêm gọi `updateModuleVisibility()` sau khi thêm dòng mới
- **Kết quả**: Khi thêm một module mới, module sections sẽ được cập nhật ngay lập tức

```javascript
function addArchRow() {
    // ... existing code ...
    updateModuleVisibility();  // NEW LINE
}
```

### 4. Cập nhật hàm `removeArchRow()` (script.js)
- **Thay đổi**: Thêm gọi `updateModuleVisibility()` sau khi xóa dòng
- **Kết quả**: Khi xóa một module, module sections sẽ được cập nhật ngay lập tức

```javascript
function removeArchRow(btn) { 
    removeRow(btn); 
    updateModuleVisibility();  // NEW LINE
}
```

### 5. Cập nhật hàm `createArchTableRow()` (script.js)
- **Thay đổi**: Thêm `onchange="updateModuleVisibility()"` vào select dropdown "Loại module"
- **Kết quả**: Khi người dùng thay đổi loại module, module sections sẽ được cập nhật ngay lập tức

```html
<select onchange="updateModuleVisibility()">
    <option value="">-- Chọn --</option>
    <option value="App">App</option>
    <option value="Redis">Redis</option>
    <!-- ... etc ... -->
</select>
```

### 6. Cập nhật hàm `loadMoHinhHeThong()` (script.js)
- **Thay đổi**: Thêm gọi `updateModuleVisibility()` ở cuối hàm (trước khi hàm kết thúc)
- **Kết quả**: Khi tải dữ liệu mô hình từ database, module sections sẽ được cập nhật theo các module đã lưu

```javascript
function loadMoHinhHeThong(data, admin) {
    // ... existing code ...
    
    // Update module visibility in sizing section based on selected modules
    updateModuleVisibility();  // NEW LINE
}
```

## Quy trình hoạt động

1. **Thêm module**: Người dùng bấm "Thêm thành phần" → Chọn loại module → Module section tương ứng hiển thị trong "Định cỡ hệ thống"
2. **Thay đổi module**: Người dùng thay đổi loại module trong dropdown → Module sections cập nhật ngay lập tức
3. **Xóa module**: Người dùng bấm nút xóa → Module bị ẩn nếu không con loại module nào được chọn nữa
4. **Tải dữ liệu**: Khi tải dự án cũ, các module đã chọn trước đó sẽ hiển thị, các module khác sẽ ẩn

## Các module được hỗ trợ
- App
- Redis
- MariaDB
- Kafka
- K8S
- LB/FW

## Lưu ý
- Phần tính toán của các module không thay đổi
- Người dùng có thể chọn nhiều loại module cùng một lúc
- Khi không chọn module nào, tất cả các module sections sẽ bị ẩn
