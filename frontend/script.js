// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8080/api';

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
    // Log ID hiện tại khi load trang
    console.log('Current SystemInfo ID from localStorage:', currentSystemInfoId);
    
    // 1. Định nghĩa nội dung cho các trang
    const pageContent = {
        // GIỮ NGUYÊN PHẦN 1
        request: `
    <div class="form-container">
        <h2 class="content-title">1. YÊU CẦU BÀI TOÁN</h2>
        <div class="form-grid">
            <div class="form-group">
                <label>1. Đơn vị phát triển <span class="info-icon" title="Ghi tên đơn vị phát triển ứng dụng">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>2. Tên dự án <span class="info-icon" title="Tên đầy đủ của dự án">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>3. Chức năng hệ thống <span class="info-icon" title="Mô tả ngắn gọn chức năng, mục đích hệ thống">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>4. Đầu mối định cỡ <span class="info-icon" title="Nhập vào đầu mối định cỡ">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>5. Mục đích định cỡ <span class="info-icon" title="Lý do sizing: Cấp phát mới, cấp phát bổ sung, Đánh giá tải để bàn giao VHKT">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>6. Cơ sở định cỡ <span class="info-icon" title="Dựa trên hệ thống tương đương, dựa trên hệ thống testlab, dựa trên hệ thống đang chạy">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>7. Nguyên tắc định cỡ <span class="info-icon" title="Tham chiếu đến tài liệu GL.CNVTQĐ.CNTT.18.150 Guideline định cỡ cấp phát hạ tầng công nghệ thông tin ban hành lần 9 bởi Ban CNTT ">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>8. Mức độ quan trọng <span class="info-icon" title="Đơn vị tự đánh giá theo Guideline đánh giá mức độ quan trọng">?</span></label>
                <input type="text">
            </div>
            <div class="form-group">
                <label>9. Thời gian triển khai <span class="info-icon" title="Công bố thời gian sẽ thực hiện đổ tải. VTNet sẽ căn cứ vào mốc này để đánh giá rà soát tải trên server. ">?</span></label>
                <input type="text">
            </div>
        </div>
        <button type="button" class="btn-submit" id="saveBtn">Lưu thông tin</button>
        <div id="save-status" style="margin-top: 10px; text-align: center;"></div>
    </div>
`,
input: `
    <div class="form-container">
        <h2 class="content-title">2. THÔNG TIN ĐẦU VÀO</h2>
        
        <p style="color: red; font-style: italic; margin-bottom: 15px; font-size: 14px;">
            &lt;Đơn vị chọn giá trị đầu vào tùy theo đặc điểm hệ thống, ở đây ví dụ sử dụng CCU. Chỉ đưa các giá trị đầu vào có sử dụng để tính toán&gt;
        </p>
        <div class="table-responsive">
            <table class="sizing-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">STT</th>
                        <th>Đầu vào</th>
                        <th>Tải hệ thống POC</th>
                        <th>Định cỡ</th>
                        <th>Module</th>
                        <th>Ghi chú</th>
                        <th style="width: 50px;">Xóa</th>
                    </tr>
                </thead>
                <tbody id="input-table-body">
                    <tr>
                        <td>1</td>
                        <td><input type="text" placeholder="Ví dụ: Tổng số người dùng CCU"></td>
                        <td><input type="text"></td>
                        <td><input type="text"></td>
                        <td><input type="text"></td>
                        <td><textarea rows="1"></textarea></td>
                        <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <button type="button" class="btn-add" id="addRowBtn">
            <i class="fa-solid fa-plus"></i> Thêm đầu vào hệ thống
        </button>

        <hr class="form-divider" style="margin: 30px 0;">
        <div class="model-section">
            <h3 class="model-type-title">
                <i class="fa-solid fa-server"></i>THÔNG TIN HỆ THỐNG THAM CHIẾU
            </h3>
            <p style="font-weight: bold; margin-bottom: 10px; font-size: 14px;">1. IP và cấu hình hệ thống tham chiếu</p>
            <div class="table-responsive">
                <table class="sizing-table">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="width: 150px;">Module</th>
                            <th style="width: 150px;">IP</th>
                            <th>CPU</th>
                            <th style="width: 100px;">RAM (GB)</th>
                            <th style="width: 120px;">Cint_rate_2017</th>
                            <th style="width: 50px;">Xóa</th>
                        </tr>
                    </thead>
                    <tbody id="baseline-specs-body">
                        <tr>
                            <td><input type="text" placeholder="Ví dụ: APP"></td>
                            <td><input type="text" placeholder="10.240.x.x"></td>
                            <td><input type="text" placeholder="Intel Xeon..."></td>
                            <td><input type="number" class="ram-val" placeholder="0" oninput="calculateBaselineTotal()"></td>
                            <td><input type="number" class="cint-val" placeholder="0" oninput="calculateBaselineTotal()"></td>
                            <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();">✖</button></td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background-color: #f9f9f9;">
                            <td colspan="3" style="text-align: center;">Tổng</td>
                            <td id="total-ram-baseline" style="text-align: center;">0</td>
                            <td id="total-cint-baseline" style="text-align: center;">0</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <button type="button" class="btn-add" id="addBaselineRowBtn" onclick="addBaselineRow()">
                <i class="fa-solid fa-plus"></i> Thêm dòng hệ thống tham chiếu
            </button>
        </div>

        <hr class="form-divider" style="margin: 30px 0;">

        <div class="model-section">
            <h3 class="model-type-title">
                <i class="fa-solid fa-certificate"></i> Sở cứ giá trị định cỡ
            </h3>
            <div id="container-evidence" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('evidence')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh sở cứ/xác minh
            </button>
        </div>
        
        <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
            <button type="button" class="btn-submit" id="saveInputDataBtn">
                <i class="fa-solid fa-floppy-disk"></i> Lưu dữ liệu
            </button>
            <div id="input-save-status" style="margin-top: 10px;"></div>
        </div>
    </div>
 `,
model: `
    <div class="form-container">
        <h2 class="content-title">3. MÔ HÌNH HỆ THỐNG</h2>
        
        <div class="model-section">
            <h3 class="model-type-title">
                <i class="fa-solid fa-server"></i> A. Mô hình Vật lý
                <span class="help-icon">
                    <i class="fa-solid fa-circle-question"></i>
                    <div class="help-content">
                        <img src="https://placehold.co/600x300/e9ecef/444?text=Anh+Mau+Vat+Ly" alt="Mẫu Vật lý">
                        <p class="help-text">Sơ đồ đấu nối vật lý giữa các máy chủ, thiết bị mạng.</p>
                    </div>
                </span>
            </h3>
            
            <div id="container-physical" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('physical')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh mô hình Vật lý
            </button>
        </div>

        <hr class="form-divider">

        <div class="model-section">
            <h3 class="model-type-title">
                <i class="fa-solid fa-network-wired"></i> B. Mô hình Logic
                <span class="help-icon">
                    <i class="fa-solid fa-circle-question"></i>
                    <div class="help-content" style="width: 500px;"> <img src="hinhanh.img/logic.png" alt="Mẫu Logic">
                        <p class="help-text" style="color: red; font-weight: bold;">
                            Lưu ý: Cần nêu rõ Module chức năng, Giao thức kết nối, Port cụ thể.
                        </p>
                    </div>
                </span>
            </h3>

            <p style="color: #d9534f; font-style: italic; font-size: 13px; margin-bottom: 10px;">
                * Yêu cầu: Nêu rõ thông tin module, giao thức và port kết nối.
            </p>

            <div id="container-logical" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('logical')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh mô hình Logic
            </button>
        </div>

        <hr class="form-divider">

        <div class="model-section">
            <h3 class="model-type-title">
                <i class="fa-solid fa-diagram-project"></i> C. Luồng nghiệp vụ
                <span class="help-icon">
                    <i class="fa-solid fa-circle-question"></i>
                    <div class="help-content">
                        <img src="https://placehold.co/600x300/e9ecef/444?text=Anh+Mau+Business+Flow" alt="Mẫu Luồng">
                        <p class="help-text">Sơ đồ luồng đi của dữ liệu/người dùng qua các hệ thống.</p>
                    </div>
                </span>
            </h3>
            
            <div id="container-flow" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('flow')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh luồng nghiệp vụ
            </button>
            <textarea id="flow-explanation" rows="3" placeholder="Giải thích luồng nghiệp vụ chi tiết..." style="width:100%; margin-top:10px; padding:10px; border-radius:4px; border:1px solid #ddd;"></textarea>
        </div>

        <hr class="form-divider" style="border-top: 2px solid #ee0000; opacity: 0.3;">

        <div class="model-section">
            <h3 class="model-type-title"><i class="fa-solid fa-list-check"></i> 5. Chi tiết các zone mạng, hệ điều hành, số lượng VIP</h3>
            <div class="table-responsive">
                <table class="sizing-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">STT</th>
                            <th>Module</th>
                            <th>Zone mạng</th>
                            <th>Hệ điều hành</th>
                            <th>Số lượng VIP</th>
                            <th style="width: 50px;">Xóa</th>
                        </tr>
                    </thead>
                    <tbody id="arch-table-body">
                        <tr>
                            <td>1</td>
                            <td><input type="text" placeholder="Ví dụ: App Server"></td>
                            <td><input type="text" placeholder="Ví dụ: Zone Internet"></td>
                            <td><input type="text" placeholder="Ví dụ: CentOS 7"></td>
                            <td><textarea rows="1" placeholder="Ví dụ: 02 VIP"></textarea></td>
                            <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <button type="button" class="btn-add" id="addArchRowBtn">
                <i class="fa-solid fa-plus"></i> Thêm thành phần hệ thống
            </button>
        </div>

        <div style="text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            <button type="button" class="btn-submit" id="saveModelBtn">
                <i class="fa-solid fa-floppy-disk"></i> Lưu mô hình hệ thống
            </button>
        </div>
    </div>
`,
        sizing: `
            <h2 style="color: red; border-left: 4px solid red; padding-left: 15px; line-height: 1.1; text-transform: uppercase;">
    4. ĐỊNH CỠ HỆ THỐNG
</h2>
            <div class="iframe-wrapper">
                <iframe id="sizing-iframe" src="http://localhost:9000" width="100%" height="800" frameborder="0" loading="lazy"></iframe>
            </div>
        `,
        summary: `
    <div class="form-container">
        <h2 class="content-title">5. TỔNG HỢP VÀ ĐỀ XUẤT</h2>
        <p style="color: red; font-style: italic; margin-bottom: 15px; font-size: 14px;">
            &lt;Trong các trường hợp Sizing bổ sung tài nguyên theo chiều dọc (tăng cấu hình) sử dụng bảng sau&gt;
        </p>
        
        <div class="table-responsive">
            <table class="sizing-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">STT</th>
                        <th>Module</th>
                        <th style="width: 100px;">Số lượng</th>
                        <th style="width: 100px;">vCPU</th>
                        <th style="width: 120px;">RAM</th>
                        <th style="width: 150px;">Volume khác (GB)</th>
                        <th>Ghi chú</th>
                        <th style="width: 50px;">Xóa</th>
                    </tr>
                </thead>
                <tbody id="summary-table-body">
                    <tr>
                        <td>1</td>
                        <td><input type="text" placeholder="Ví dụ: APP Service"></td>
                        <td><input type="number" value="1"></td>
                        <td><input type="number" value="1"></td>
                        <td><input type="text" placeholder="Ví dụ: 24"></td>
                        <td><input type="text" placeholder="/u01: 100"></td>
                        <td><textarea rows="1"></textarea></td>
                        <td><button class="btn-delete" onclick="removeSummaryRow(this)">✖</button></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <button type="button" class="btn-add" id="addSummaryRowBtn">
            <i class="fa-solid fa-plus"></i> Thêm dòng đề xuất
        </button>

        <div style="margin-top: 30px; display: flex; justify-content: space-around; font-weight: bold; text-align: center;">
            
        </div>

        <div style="margin-top: 20px; text-align: center;">
            <button type="button" class="btn-submit" id="exportBtn">
                <i class="fa-solid fa-file-word"></i> XUẤT BÁO CÁO (WORD)
            </button>
            <div id="export-status" style="margin-top: 10px;"></div>
        </div>
    </div>
`,
    };

    const contentArea = document.getElementById('main-display');
    const menuLinks = document.querySelectorAll('.side-menu a');

    menuLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        const pageId = this.getAttribute('data-page');

        if (contentArea && pageContent[pageId]) {
            contentArea.innerHTML = pageContent[pageId];

            // Chờ một chút để DOM kịp cập nhật HTML mới
            setTimeout(() => {
                // 1. Logic trang Yêu cầu bài toán
                if (pageId === 'request') {
                    const saveBtn = document.getElementById('saveBtn');
                    if (saveBtn) {
                        saveBtn.onclick = saveSystemInfo;
                    }
                }

                // 2. Logic trang Thông tin đầu vào
                if (pageId === 'input') {
                    const addRowBtn = document.getElementById('addRowBtn');
                    if (addRowBtn) {
                        addRowBtn.onclick = addRow;
                    }
                    // Thêm sự kiện cho nút Lưu dữ liệu
                    const saveInputDataBtn = document.getElementById('saveInputDataBtn');
                    if (saveInputDataBtn) {
                        saveInputDataBtn.onclick = saveInputData;
                    }
                }

                // 3. Logic trang MÔ HÌNH HỆ THỐNG (Mục bạn cần thêm)
                if (pageId === 'model') {
                    const addArchBtn = document.getElementById('addArchRowBtn');
                    if (addArchBtn) {
                        addArchBtn.onclick = function(e) {
                            e.preventDefault();
                            const tbody = document.getElementById('arch-table-body');
                            if (!tbody) return;

                            const nextSTT = tbody.rows.length + 1;
                            const newRow = document.createElement('tr');
                            newRow.innerHTML = `
                                <td>${nextSTT}</td>
                                <td><input type="text" placeholder="Tên Module"></td>
                                <td><input type="text" placeholder="Vùng mạng"></td>
                                <td><input type="text" placeholder="Hệ điều hành"></td> 
                                <td><textarea rows="1" placeholder="Ghi chú VIP"></textarea></td>
                                <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
                            `;
                            tbody.appendChild(newRow);
                        };
                    }
                }

                // 4. Logic trang Tổng hợp và đề xuất
                if (pageId === 'summary') {
                    const addSummaryBtn = document.getElementById('addSummaryRowBtn');
                    if (addSummaryBtn) {
                        addSummaryBtn.onclick = function() {
                            const tbody = document.getElementById('summary-table-body');
                            const nextSTT = tbody.rows.length + 1;
                            const newRow = document.createElement('tr');
                            newRow.innerHTML = `
                                <td>${nextSTT}</td>
                                <td><input type="text"></td>
                                <td><input type="number" value="1"></td>
                                <td><input type="number" value="1"></td>
                                <td><input type="text"></td>
                                <td><input type="text"></td>
                                <td><textarea rows="1"></textarea></td>
                                <td><button type="button" class="btn-delete" onclick="removeSummaryRow(this)">✖</button></td>
                            `;
                            tbody.appendChild(newRow);
                        };
                    }
                    // Thêm sự kiện cho nút xuất báo cáo
                    const exportBtn = document.getElementById('exportBtn');
                    if (exportBtn) {
                        exportBtn.onclick = exportToWord;
                    }
                }
            }, 50);
        }

        // Đổi màu Active cho menu
        menuLinks.forEach(item => item.classList.remove('active-menu'));
        this.classList.add('active-menu');
    });
});
    // Hàm thêm dòng mới
    function addRow() {
        const tbody = document.getElementById('input-table-body');
        const nextSTT = tbody.rows.length + 1;
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>${nextSTT}</td>
            <td><input type="text"></td>
            <td><input type="text"></td>
            <td><input type="text"></td>
            <td><input type="text"></td>
            <td><textarea rows="1"></textarea></td>
            <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
        `;
        tbody.appendChild(newRow);
    }
});

// Hàm xóa dòng (để ngoài để thuộc tính onclick của button có thể gọi tới)
function removeRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    
    // Đánh số lại STT
    Array.from(tbody.rows).forEach((r, index) => {
        r.cells[0].innerText = index + 1;
    });
}
function removeSummaryRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    
    // Cập nhật lại STT
    Array.from(tbody.rows).forEach((r, index) => {
        r.cells[0].innerText = index + 1;
    });
}
function removeArchRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    // Cập nhật lại STT
    Array.from(tbody.rows).forEach((r, index) => {
        r.cells[0].innerText = index + 1;
    });
}
// Hàm tạo ô upload ảnh mới dựa trên loại mô hình
function createUploadBox(type) {
    const container = document.getElementById(`container-${type}`);
    const boxId = 'img-' + Date.now(); // Tạo ID duy nhất

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

// Hàm hiển thị ảnh sau khi chọn file
function previewModelImage(input, boxId) {
    const previewArea = document.getElementById(`preview-${boxId}`);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
if (document.getElementById('addRowBtn')) {
    // Kích hoạt nút thêm dòng cho bảng (nếu có)
    const addRowBtn = document.getElementById('addRowBtn');
    if(addRowBtn) addRowBtn.onclick = addRow;
    
    // Nút thêm ảnh sở cứ sử dụng chung hàm createUploadBox đã viết ở phần Mô hình
}
function addBaselineRow() {
    const tbody = document.getElementById('baseline-specs-body');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td><input type="text"></td>
        <td><input type="text"></td>
        <td><input type="text"></td>
        <td><input type="number" class="ram-val" oninput="calculateBaselineTotal()"></td>
        <td><input type="number" class="cint-val" oninput="calculateBaselineTotal()"></td>
        <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();">✖</button></td>
    `;
    tbody.appendChild(newRow);
}

function calculateBaselineTotal() {
    let totalRam = 0;
    let totalCint = 0;
    document.querySelectorAll('.ram-val').forEach(input => totalRam += parseFloat(input.value) || 0);
    document.querySelectorAll('.cint-val').forEach(input => totalCint += parseFloat(input.value) || 0);
    
    document.getElementById('total-ram-baseline').innerText = totalRam;
    document.getElementById('total-cint-baseline').innerText = totalCint;
}

// ========== CÁC HÀM GỌI API BACKEND ==========

// Hàm lưu thông tin hệ thống (Yêu cầu bài toán)
async function saveSystemInfo() {
    const inputs = document.querySelectorAll('.form-grid input');
    const statusDiv = document.getElementById('save-status');
    
    // Lấy giá trị từ 9 input fields theo thứ tự
    const data = {
        devUnit: inputs[0]?.value || '',           // 1. Đơn vị phát triển
        projectName: inputs[1]?.value || '',       // 2. Tên dự án
        sysFeature: inputs[2]?.value || '',        // 3. Chức năng hệ thống
        contactPerson: inputs[3]?.value || '',     // 4. Đầu mối định cỡ
        sizingPurpose: inputs[4]?.value || '',     // 5. Mục đích định cỡ
        sizingBasis: inputs[5]?.value || '',       // 6. Cơ sở định cỡ
        sizingRule: inputs[6]?.value || '',        // 7. Nguyên tắc định cỡ
        importance: inputs[7]?.value || '',        // 8. Mức độ quan trọng
        deploymentTime: formatDateForAPI(inputs[8]?.value) // 9. Thời gian triển khai
    };

    try {
        const response = await fetch(`${API_BASE_URL}/system-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            // Lưu SystemInfo ID vào localStorage để không bị mất khi reload
            saveSystemInfoIdToStorage(result.id);
            
            if (statusDiv) {
                statusDiv.innerHTML = '<span style="color: green;">✓ Lưu thông tin thành công! (ID: ' + currentSystemInfoId + ')</span>';
            }
            alert('Đã lưu thông tin dự án thành công!');
        } else {
            const error = await response.text();
            if (statusDiv) {
                statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi khi lưu thông tin!</span>';
            }
            alert('Lỗi khi lưu: ' + error);
        }
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Không thể kết nối đến server!</span>';
        }
        alert('Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy tại port 8080.');
    }
}

// Hàm format ngày sang định dạng dd/MM/yyyy
function formatDateForAPI(dateStr) {
    if (!dateStr) return null;
    
    // Nếu input là yyyy-MM-dd (từ input type="date")
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    
    // Nếu đã là dd/MM/yyyy thì giữ nguyên
    return dateStr;
}

// Hàm lưu thông tin đầu vào (ThongTinDauVao, HeThongThamChieu, SoCuThongTinDauVao)
async function saveInputData() {
    const statusDiv = document.getElementById('input-save-status');
    
    // Kiểm tra xem đã có SystemInfo ID chưa
    if (!currentSystemInfoId) {
        alert('Vui lòng lưu thông tin "Yêu cầu bài toán" trước!');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Chưa có SystemInfo ID. Hãy lưu Yêu cầu bài toán trước!</span>';
        }
        return;
    }
    
    try {
        let savedThongTinDauVao = 0;
        let savedHeThongThamChieu = 0;
        let uploadedImages = 0;
        let errorCount = 0;
        
        // 1. Lưu các dòng thông tin đầu vào từ bảng đầu tiên
        const inputRows = document.querySelectorAll('#input-table-body tr');
        for (const row of inputRows) {
            const cells = row.querySelectorAll('td');
            const data = {
                dauVao: cells[1]?.querySelector('input')?.value || '',
                taiHeThongPOC: cells[2]?.querySelector('input')?.value || '',
                dinhCo: cells[3]?.querySelector('input')?.value || '',
                module: cells[4]?.querySelector('input')?.value || '',
                ghiChu: cells[5]?.querySelector('textarea')?.value || ''
            };
            
            // Chỉ lưu nếu có ít nhất 1 trường có giá trị
            if (data.dauVao || data.taiHeThongPOC || data.dinhCo || data.module || data.ghiChu) {
                try {
                    const response = await fetch(`${API_BASE_URL}/thong-tin-dau-vao/system-info/${currentSystemInfoId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (response.ok) savedThongTinDauVao++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error saving ThongTinDauVao:', e);
                }
            }
        }
        
        // 2. Lưu các dòng hệ thống tham chiếu
        const baselineRows = document.querySelectorAll('#baseline-specs-body tr');
        for (const row of baselineRows) {
            const inputs = row.querySelectorAll('input');
            const data = {
                module: inputs[0]?.value || '',
                ip: inputs[1]?.value || '',
                cpu: inputs[2]?.value || '',
                ram: parseFloat(inputs[3]?.value) || 0,
                cintRate2017: parseFloat(inputs[4]?.value) || 0
            };
            
            // Chỉ lưu nếu có ít nhất module hoặc IP
            if (data.module || data.ip) {
                try {
                    const response = await fetch(`${API_BASE_URL}/he-thong-tham-chieu/system-info/${currentSystemInfoId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (response.ok) savedHeThongThamChieu++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error saving HeThongThamChieu:', e);
                }
            }
        }
        
        // 3. Upload các ảnh sở cứ
        const uploadBoxes = document.querySelectorAll('#container-evidence .upload-box');
        for (const box of uploadBoxes) {
            const fileInput = box.querySelector('input[type="file"]');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                
                try {
                    const response = await fetch(`${API_BASE_URL}/so-cu-thong-tin-dau-vao/system-info/${currentSystemInfoId}/upload`, {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) uploadedImages++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error uploading image:', e);
                }
            }
        }
        
        // Hiển thị kết quả
        const message = `Đã lưu thành công:
- ${savedThongTinDauVao} dòng thông tin đầu vào
- ${savedHeThongThamChieu} dòng hệ thống tham chiếu
- ${uploadedImages} ảnh sở cứ
${errorCount > 0 ? `\nCó ${errorCount} lỗi xảy ra.` : ''}`;

        if (errorCount === 0) {
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công: ${savedThongTinDauVao} thông tin đầu vào, ${savedHeThongThamChieu} hệ thống tham chiếu, ${uploadedImages} ảnh</span>`;
            }
        } else {
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: orange;">⚠ Có ${errorCount} lỗi xảy ra</span>`;
            }
        }
        alert(message);
        
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Không thể kết nối đến server!</span>';
        }
        alert('Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.');
    }
}

// Hàm xuất báo cáo Word
async function exportToWord() {
    const statusDiv = document.getElementById('export-status');
    
    // Kiểm tra xem đã có SystemInfo ID chưa
    if (!currentSystemInfoId) {
        alert('Vui lòng lưu thông tin "Yêu cầu bài toán" trước khi xuất báo cáo!');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Chưa có dữ liệu để xuất!</span>';
        }
        return;
    }
    
    try {
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang tạo báo cáo...</span>';
        }
        
        const response = await fetch(`${API_BASE_URL}/system-info/${currentSystemInfoId}/export`, {
            method: 'GET'
        });

        if (response.ok) {
            // Tạo blob từ response
            const blob = await response.blob();
            
            // Tạo link download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bao-cao-dinh-co.docx';
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            if (statusDiv) {
                statusDiv.innerHTML = '<span style="color: green;">✓ Đã xuất báo cáo thành công!</span>';
            }
            alert('Đã xuất báo cáo thành công!');
        } else {
            const error = await response.text();
            if (statusDiv) {
                statusDiv.innerHTML = '<span style="color: red;">✗ Lỗi khi xuất báo cáo!</span>';
            }
            alert('Lỗi khi xuất báo cáo: ' + error);
        }
    } catch (error) {
        console.error('Error:', error);
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Không thể kết nối đến server!</span>';
        }
        alert('Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.');
    }
}
