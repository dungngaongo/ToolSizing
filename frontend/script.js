document.addEventListener("DOMContentLoaded", function () {
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
            <button type="button" class="btn-submit" onclick="alert('Đã lưu toàn bộ thông tin đầu vào, hệ thống tham chiếu và ảnh sở cứ!')">
                <i class="fa-solid fa-floppy-disk"></i> Lưu dữ liệu
            </button>
        </div>
    </div>
 `,
 model: `
    <div class="form-container">
        <h2 class="content-title">3. MÔ HÌNH HỆ THỐNG</h2>
        
        <div class="model-section">
            <h3 class="model-type-title"><i class="fa-solid fa-server"></i> A. Mô hình Vật lý (Physical Architecture)</h3>
            <div id="container-physical" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('physical')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh mô hình Vật lý
            </button>
        </div>

        <hr class="form-divider">

        <div class="model-section">
            <h3 class="model-type-title"><i class="fa-solid fa-network-wired"></i> B. Mô hình Logic (Logical Architecture)</h3>
            <div id="container-logical" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('logical')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh mô hình Logic
            </button>
        </div>

        <hr class="form-divider">

        <div class="model-section">
            <h3 class="model-type-title"><i class="fa-solid fa-diagram-project"></i> C. Luồng nghiệp vụ (Business Flow)</h3>
            <div id="container-flow" class="image-upload-grid"></div>
            <button type="button" class="btn-add-img" onclick="createUploadBox('flow')">
                <i class="fa-solid fa-plus"></i> Thêm ảnh luồng nghiệp vụ
            </button>
            <textarea id="flow-explanation" rows="3" placeholder="Giải thích luồng nghiệp vụ chi tiết..." style="width:100%; margin-top:10px; padding:10px; border-radius:4px; border:1px solid #ddd; font-family:inherit;"></textarea>
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
                <iframe id="sizing-iframe" src="http://localhost:8503" width="100%" height="800" frameborder="0" loading="lazy"></iframe>
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
            <button type="button" class="btn-submit" onclick="exportToWord()">
                <i class="fa-solid fa-file-word"></i> XUẤT BÁO CÁO (WORD)
            </button>
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
                        saveBtn.onclick = () => alert("Hệ thống đã lưu 9 thông tin dự án của bạn!");
                    }
                }

                // 2. Logic trang Thông tin đầu vào
                if (pageId === 'input') {
                    const addRowBtn = document.getElementById('addRowBtn');
                    if (addRowBtn) {
                        addRowBtn.onclick = addRow;
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
if (pageId === 'input') {
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