// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu SystemInfo ID hiện tại - khôi phục từ localStorage nếu có
let currentSystemInfoId = localStorage.getItem('currentSystemInfoId') || null;

// Hàm lưu SystemInfo ID vào localStorage
function saveSystemInfoIdToStorage(id) {
    currentSystemInfoId = id;
    localStorage.setItem('currentSystemInfoId', id);
    console.log('Saved SystemInfo ID to localStorage:', id);
}

// Hàm xóa SystemInfo ID (khi muốn tạo mới)
function clearSystemInfoId() {
    currentSystemInfoId = null;
    localStorage.removeItem('currentSystemInfoId');
    console.log('Cleared SystemInfo ID');
}

document.addEventListener("DOMContentLoaded", function () {
    console.log('Current SystemInfo ID from localStorage:', currentSystemInfoId);

    // --- 1. XỬ LÝ CHUYỂN TAB (NAVIGATION) ---
    const menuLinks = document.querySelectorAll(".side-menu a");
    const pages = document.querySelectorAll(".page-section");

    menuLinks.forEach(link => {
        link.addEventListener("click", function(e) {
            e.preventDefault();

            // Xóa class active ở tất cả menu
            menuLinks.forEach(l => l.classList.remove("active"));
            // Thêm class active cho menu vừa click
            this.classList.add("active");

            // Ẩn tất cả các trang
            pages.forEach(page => page.classList.remove("active"));

            // Hiện trang tương ứng dựa vào data-target
            const targetId = "page-" + this.getAttribute("data-target");
            const targetPage = document.getElementById(targetId);
            
            if (targetPage) {
                targetPage.classList.add("active");
                
                // Xử lý riêng cho trang Sizing (Load iframe)
                if (this.getAttribute("data-target") === 'sizing') {
                    const sizingIframe = document.getElementById('sizing-iframe');
                    if (sizingIframe && currentSystemInfoId) {
                        // Reload iframe với ID mới nhất
                        const baseUrl = sizingIframe.src.split('?')[0];
                        sizingIframe.src = `${baseUrl}?systemInfoId=${currentSystemInfoId}`;
                    }
                }
            }
        });
    });

    // --- 2. GÁN SỰ KIỆN CHO CÁC NÚT (EVENT LISTENERS) ---
    
    // Nút lưu Yêu cầu bài toán
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.onclick = saveSystemInfo;

    // Nút thêm dòng Thông tin đầu vào
    const addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn) addRowBtn.onclick = addRow;

    // Nút lưu Thông tin đầu vào
    const saveInputDataBtn = document.getElementById('saveInputDataBtn');
    if (saveInputDataBtn) saveInputDataBtn.onclick = saveInputData;

    // Nút thêm dòng Baseline
    const addBaselineBtn = document.getElementById('addBaselineRowBtn');
    if (addBaselineBtn) addBaselineBtn.onclick = addBaselineRow;

    // Nút thêm dòng Zone mạng (Mô hình hệ thống)
    const addArchBtn = document.getElementById('addArchRowBtn');
    if (addArchBtn) {
        addArchBtn.onclick = function() {
            const tbody = document.getElementById('arch-table-body');
            const rowCount = tbody.rows.length + 1;
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${rowCount}</td>
                <td><input type="text" placeholder="Ví dụ: App Server"></td>
                <td><input type="text" placeholder="Ví dụ: Zone Internet"></td>
                <td><input type="text" placeholder="Ví dụ: CentOS 7"></td>
                <td><textarea rows="1" placeholder="Ví dụ: 02 VIP"></textarea></td>
                <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
            `;
            tbody.appendChild(newRow);
        };
    }

    // Nút lưu Mô hình hệ thống
    const saveModelBtn = document.getElementById('saveModelBtn');
    if (saveModelBtn) saveModelBtn.onclick = saveModelData;

    // Nút thêm dòng Tổng hợp đề xuất
    const addSummaryBtn = document.getElementById('addSummaryRowBtn');
    if (addSummaryBtn) {
        addSummaryBtn.onclick = function() {
            const tbody = document.getElementById('summary-table-body');
            const rowCount = tbody.rows.length + 1;
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>${rowCount}</td>
                <td><input type="text" placeholder="Ví dụ: APP Service"></td>
                <td><input type="number" value="1"></td>
                <td><input type="number" value="1"></td>
                <td><input type="text" placeholder="Ví dụ: 24"></td>
                <td><input type="text" placeholder="/u01: 100"></td>
                <td><textarea rows="1"></textarea></td>
                <td><button class="btn-delete" onclick="removeSummaryRow(this)">✖</button></td>
            `;
            tbody.appendChild(newRow);
        };
    }

    // Nút lưu Tổng hợp
    const saveSummaryBtn = document.getElementById('saveSummaryBtn');
    if (saveSummaryBtn) saveSummaryBtn.onclick = saveSummaryData;

    // Nút xuất báo cáo
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.onclick = exportToWord;
});

// --- 3. CÁC HÀM XỬ LÝ GIAO DIỆN (UI FUNCTIONS) ---

// Tìm hàm addRow() cũ và thay thế bằng nội dung này:

function addRow() {
    const tbody = document.getElementById('input-table-body');
    const nextSTT = tbody.rows.length + 1;
    const newRow = document.createElement('tr');
    
    newRow.innerHTML = `
        <td>${nextSTT}</td>
        <td><textarea rows="3" placeholder="Ví dụ: Tổng số người dùng CCU" class="input-textarea"></textarea></td>
        <td><textarea rows="3" class="input-textarea"></textarea></td>
        <td><textarea rows="3" class="input-textarea"></textarea></td>
        <td><input type="text"></td>
        <td><textarea rows="3" class="input-textarea"></textarea></td>
        
        <td><textarea rows="3" class="input-textarea"></textarea></td>
        
        <td style="text-align: center; vertical-align: middle;">
            <input type="checkbox" style="width: 20px; height: 20px; cursor: pointer;">
        </td>
        
        <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
    `;
    tbody.appendChild(newRow);
}

function removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

function removeSummaryRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

function removeArchRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    updateSTT(tbody);
}

// Hàm cập nhật lại số thứ tự (STT) cho bảng
function updateSTT(tbody) {
    Array.from(tbody.rows).forEach((r, index) => {
        if(r.cells[0]) r.cells[0].innerText = index + 1;
    });
}

function createUploadBox(type) {
    const containerId = 'container-' + type;
    const container = document.getElementById(containerId);
    if(!container) return;

    const boxId = 'img-' + Date.now();
    const div = document.createElement('div');
    div.className = 'upload-box';
    div.id = boxId;
    div.innerHTML = `
        <div class="upload-controls">
            <input type="file" accept="image/*" onchange="previewModelImage(this, '${boxId}')" style="display: none;" id="input-${boxId}">
            <label for="input-${boxId}" class="upload-label">
                <i class="fa-solid fa-cloud-arrow-up"></i>
                <span>Chọn ảnh</span>
            </label>
            <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove()">✖</button>
        </div>
        <div class="preview-area" id="preview-${boxId}"></div>
    `;
    container.appendChild(div);
}

function previewModelImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 100%; height: auto; margin-top: 10px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Tìm đến đoạn gán sự kiện cho addBaselineRowBtn và sửa lại hàm addBaselineRow như sau:

function addBaselineRow() {
    const tbody = document.getElementById('baseline-specs-body');
    const newRow = document.createElement('tr');
    
    // Cập nhật HTML cho dòng mới
    newRow.innerHTML = `
        <td>
            <select style="width: 100%; padding: 8px; border: 1px solid transparent; background: transparent;">
                <option value="APP">APP</option>
                <option value="DB">DB</option>
            </select>
        </td>
        <td><input type="text" placeholder="10.240.x.x"></td>
        <td><input type="text" placeholder="Intel Xeon..."></td>
        <td><input type="number" class="ram-val" placeholder="0" oninput="calculateBaselineTotal()"></td>
        <td><input type="number" class="cint-val" placeholder="0" oninput="calculateBaselineTotal()"></td>
        <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();">✖</button></td>
    `;
    tbody.appendChild(newRow);
}

function calculateBaselineTotal() {
    let totalRam = 0;
    let totalCint = 0;
    document.querySelectorAll('.ram-val').forEach(input => totalRam += parseFloat(input.value) || 0);
    document.querySelectorAll('.cint-val').forEach(input => totalCint += parseFloat(input.value) || 0);
    
    const ramEl = document.getElementById('total-ram-baseline');
    const cintEl = document.getElementById('total-cint-baseline');
    
    if(ramEl) ramEl.innerText = totalRam;
    if(cintEl) cintEl.innerText = totalCint;
}

// --- 4. CÁC HÀM GỌI API (BACKEND INTEGRATION) ---

// Hàm format ngày (giữ nguyên logic)
function formatDateForAPI(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// Lưu Yêu cầu bài toán
async function saveSystemInfo() {
    // Lấy input từ form cụ thể trong page-request
    const pageRequest = document.getElementById('page-request');
    const inputs = pageRequest.querySelectorAll('input'); 
    const statusDiv = document.getElementById('save-status');
    
    // Map đúng thứ tự input trong HTML mới
    const data = {
        devUnit: inputs[0]?.value || '', 
        projectName: inputs[1]?.value || '', 
        sysFeature: inputs[2]?.value || '', 
        contactPerson: inputs[3]?.value || '', 
        sizingPurpose: inputs[4]?.value || '', 
        sizingBasis: inputs[5]?.value || '', 
        sizingRule: inputs[6]?.value || '', 
        importance: inputs[7]?.value || '', 
        deploymentTime: formatDateForAPI(inputs[8]?.value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/system-info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            saveSystemInfoIdToStorage(result.id);
            if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công! (ID: ${currentSystemInfoId})</span>`;
            alert('Đã lưu thông tin dự án thành công!');
        } else {
            throw new Error(await response.text());
        }
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi kết nối!</span>';
        alert('Lỗi: ' + error.message);
    }
}

// Lưu Thông tin đầu vào
async function saveInputData() {
    const statusDiv = document.getElementById('input-save-status');
    if (!currentSystemInfoId) return alert('Vui lòng lưu "Yêu cầu bài toán" trước!');
    
    try {
        let successCount = 0;
        
       // Trong hàm saveInputData(), tìm đoạn vòng lặp "1. Lưu bảng thông tin đầu vào" và sửa lại:

        // 1. Lưu bảng thông tin đầu vào
        const inputRows = document.querySelectorAll('#input-table-body tr');
        for (const row of inputRows) {
            const cells = row.querySelectorAll('td');
            
            // Lấy checkbox
            const checkbox = cells[7]?.querySelector('input[type="checkbox"]');

            const data = {
                dauVao: cells[1]?.querySelector('textarea')?.value || '',
                taiHeThongPOC: cells[2]?.querySelector('textarea')?.value || '',
                dinhCo: cells[3]?.querySelector('textarea')?.value || '',
                module: cells[4]?.querySelector('input')?.value || '',
                ghiChu: cells[5]?.querySelector('textarea')?.value || '',
                
                // Lấy dữ liệu 2 cột mới (Lưu ý chỉ số index của cells)
                adminNote: cells[6]?.querySelector('textarea')?.value || '',
                adminConfirmed: checkbox ? checkbox.checked : false
            };

            // Chỉ lưu nếu có dữ liệu quan trọng
            if (data.dauVao || data.module) {
                await fetch(`${API_BASE_URL}/thong-tin-dau-vao/system-info/${currentSystemInfoId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                successCount++;
            }
        }

        // Trong hàm saveInputData, tìm đoạn lưu Baseline (mục 2) và sửa:

        // 2. Lưu Baseline
        const baselineRows = document.querySelectorAll('#baseline-specs-body tr');
        for (const row of baselineRows) {
            // SỬA: Lấy thẻ select ở ô đầu tiên
            const moduleSelect = row.querySelector('select'); 
            const inputs = row.querySelectorAll('input');
            
            const data = {
                module: moduleSelect?.value || 'APP', // Lấy giá trị từ Select Box
                ip: inputs[0]?.value || '',           // inputs[0] bây giờ là IP (vì cột đầu là select, ko phải input nữa)
                cpu: inputs[1]?.value || '',
                ram: parseFloat(inputs[2]?.value) || 0,
                cintRate2017: parseFloat(inputs[3]?.value) || 0
            };
            
            if (data.ip) { // Chỉ lưu nếu có IP
                // ... (phần gọi API giữ nguyên) ...
            }
        }

        // 3. Upload ảnh Sở cứ
        const evidenceBoxes = document.querySelectorAll('#container-evidence .upload-box');
        for (const box of evidenceBoxes) {
            const fileInput = box.querySelector('input[type="file"]');
            if (fileInput?.files[0]) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                await fetch(`${API_BASE_URL}/so-cu-thong-tin-dau-vao/system-info/${currentSystemInfoId}/upload`, {
                    method: 'POST',
                    body: formData
                });
                successCount++;
            }
        }

        if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">✓ Đã lưu ${successCount} mục dữ liệu.</span>`;
        alert('Lưu dữ liệu thành công!');

    } catch (e) {
        console.error(e);
        alert('Có lỗi xảy ra khi lưu dữ liệu.');
    }
}

// Lưu Mô hình hệ thống
async function saveModelData() {
    const statusDiv = document.getElementById('model-save-status');
    if (!currentSystemInfoId) return alert('Vui lòng lưu "Yêu cầu bài toán" trước!');

    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang xử lý...</span>';

        // Helper upload ảnh
        const uploadImg = async (type, endpoint) => {
            const boxes = document.querySelectorAll(`#container-${type} .upload-box`);
            for (const box of boxes) {
                const fileInput = box.querySelector('input[type="file"]');
                if (fileInput?.files[0]) {
                    const formData = new FormData();
                    formData.append('file', fileInput.files[0]);
                    await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}/${endpoint}`, {
                        method: 'POST',
                        body: formData
                    });
                }
            }
        };

        await uploadImg('physical', 'mo-hinh-vat-ly');
        await uploadImg('logical', 'mo-hinh-logic');
        await uploadImg('flow', 'luong-nghiep-vu');

        // Lưu mô tả luồng
        const desc = document.getElementById('flow-explanation')?.value;
        if (desc) {
            await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}/luong-nghiep-vu-description`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(desc)
            });
        }

        // Lưu bảng Zone mạng
        const rows = document.querySelectorAll('#arch-table-body tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const data = {
                module: cells[1]?.querySelector('input')?.value || '',
                zoneMang: cells[2]?.querySelector('input')?.value || '',
                heDieuHanh: cells[3]?.querySelector('input')?.value || '',
                soLuongVIP: parseInt(cells[4]?.querySelector('textarea')?.value) || 0
            };
            if (data.module) {
                await fetch(`${API_BASE_URL}/mo-hinh-he-thong/system-info/${currentSystemInfoId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
        }

        if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Lưu mô hình thành công!</span>';
        alert('Lưu mô hình thành công!');

    } catch (e) {
        console.error(e);
        alert('Lỗi khi lưu mô hình.');
    }
}

// Lưu Tổng hợp
async function saveSummaryData() {
    const statusDiv = document.getElementById('summary-save-status');
    if (!currentSystemInfoId) return alert('Chưa có SystemInfo ID!');

    try {
        const rows = document.querySelectorAll('#summary-table-body tr');
        let count = 0;
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            const data = {
                module: cells[1]?.querySelector('input')?.value || '',
                soLuong: parseInt(cells[2]?.querySelector('input')?.value) || 1,
                vCPU: parseInt(cells[3]?.querySelector('input')?.value) || 1,
                ram: parseFloat(cells[4]?.querySelector('input')?.value) || 0,
                volume: cells[5]?.querySelector('input')?.value || '',
                ghiChu: cells[6]?.querySelector('textarea')?.value || ''
            };
            if (data.module) {
                await fetch(`${API_BASE_URL}/tong-hop/system-info/${currentSystemInfoId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                count++;
            }
        }
        if (statusDiv) statusDiv.innerHTML = `<span style="color: green;">✓ Đã lưu ${count} dòng.</span>`;
        alert('Lưu thành công!');
    } catch (e) {
        console.error(e);
        alert('Lỗi khi lưu tổng hợp.');
    }
}

// Xuất báo cáo
async function exportToWord() {
    const statusDiv = document.getElementById('summary-save-status');
    if (!currentSystemInfoId) return alert('Chưa có dữ liệu!');

    try {
        if (statusDiv) statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang tạo file...</span>';
        
        const response = await fetch(`${API_BASE_URL}/system-info/${currentSystemInfoId}/export`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Sizing_Report_${currentSystemInfoId}.docx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            if (statusDiv) statusDiv.innerHTML = '<span style="color: green;">✓ Xuất file thành công!</span>';
        } else {
            throw new Error('Server trả về lỗi');
        }
    } catch (e) {
        console.error(e);
        if (statusDiv) statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi xuất file!</span>';
        alert('Không thể xuất báo cáo.');
    }
}