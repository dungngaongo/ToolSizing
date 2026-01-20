// Cấu hình API Backend
const API_BASE_URL = 'http://localhost:8081/api';

// Biến lưu SystemInfo ID hiện tại - khôi phục từ localStorage nếu có
let currentSystemInfoId = localStorage.getItem('currentSystemInfoId') || null;

// Biến lưu trang hiện tại để auto-save
let currentPageId = null;

// Hàm lưu cache cho trang hiện tại (gọi từ các sự kiện)
function saveFormCacheForCurrentPage() {
    if (currentPageId) {
        saveFormCache(currentPageId);
    }
}

// ========== HỆ THỐNG CACHE FORM DATA ==========

// Hàm lấy ảnh base64 từ container
function getImagesFromContainer(containerId) {
    const container = document.getElementById(containerId);
    const images = [];
    if (container) {
        container.querySelectorAll('.upload-box').forEach(box => {
            const img = box.querySelector('.preview-area img');
            if (img && img.src) {
                images.push(img.src);
            }
        });
    }
    return images;
}

// Hàm khôi phục ảnh vào container
function restoreImagesToContainer(containerId, images) {
    const container = document.getElementById(containerId);
    if (!container || !images || images.length === 0) return;
    
    images.forEach(imgSrc => {
        const boxId = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
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
                <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove(); saveFormCacheForCurrentPage();">✖</button>
            </div>
            <div class="preview-area" id="preview-${boxId}">
                <img src="${imgSrc}" alt="Preview">
            </div>
        `;
        container.appendChild(div);
    });
}

// Hàm khôi phục ảnh từ đường dẫn file trong DB
function restoreImageFromPath(containerId, filePath) {
    const container = document.getElementById(containerId);
    if (!container || !filePath) return;
    
    const boxId = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Tạo URL để fetch ảnh từ backend
    const imageUrl = `${API_BASE_URL}/files/uploads?path=${encodeURIComponent(filePath)}`;
    
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
            <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove(); saveFormCacheForCurrentPage();">✖</button>
        </div>
        <div class="preview-area" id="preview-${boxId}">
            <img src="${imageUrl}" alt="Preview" onerror="this.parentElement.innerHTML='<span style=color:red;>Không tải được ảnh</span>'">
        </div>
    `;
    container.appendChild(div);
}

// Lưu SystemInfo ID vào localStorage
function saveSystemInfoIdToStorage(id) {
    currentSystemInfoId = id;
    localStorage.setItem('currentSystemInfoId', id);
    updateProjectStatusDisplay();
    console.log('Saved SystemInfo ID to localStorage:', id);
}

// Xóa toàn bộ cache và tạo project mới
function clearAllCacheAndCreateNew() {
    if (!confirm('Bạn có chắc muốn tạo dự án mới? Tất cả dữ liệu chưa lưu vào DB sẽ bị xóa.')) {
        return;
    }
    // Xóa SystemInfo ID
    currentSystemInfoId = null;
    localStorage.removeItem('currentSystemInfoId');
    
    // Xóa toàn bộ form cache
    localStorage.removeItem('formCache_request');
    localStorage.removeItem('formCache_input');
    localStorage.removeItem('formCache_model');
    localStorage.removeItem('formCache_summary');
    
    updateProjectStatusDisplay();
    alert('Đã xóa cache! Bạn có thể bắt đầu dự án mới.');
    
    // Reload trang để reset UI
    location.reload();
}

// Lưu form data vào cache theo page
function saveFormCache(pageId) {
    let formData = {};
    
    switch(pageId) {
        case 'request':
            const requestInputs = document.querySelectorAll('.form-grid input');
            formData = {
                devUnit: requestInputs[0]?.value || '',
                projectName: requestInputs[1]?.value || '',
                sysFeature: requestInputs[2]?.value || '',
                contactPerson: requestInputs[3]?.value || '',
                sizingPurpose: requestInputs[4]?.value || '',
                sizingBasis: requestInputs[5]?.value || '',
                sizingRule: requestInputs[6]?.value || '',
                importance: requestInputs[7]?.value || '',
                deploymentTime: requestInputs[8]?.value || ''
            };
            break;
            
        case 'input':
            // Lưu bảng thông tin đầu vào
            const inputTableBody = document.getElementById('input-table-body');
            formData.inputRows = [];
            if (inputTableBody) {
                inputTableBody.querySelectorAll('tr').forEach(row => {
                    const inputs = row.querySelectorAll('input, textarea');
                    formData.inputRows.push({
                        dauVao: inputs[0]?.value || '',
                        taiPOC: inputs[1]?.value || '',
                        dinhCo: inputs[2]?.value || '',
                        module: inputs[3]?.value || '',
                        ghiChu: inputs[4]?.value || ''
                    });
                });
            }
            
            // Lưu bảng hệ thống tham chiếu
            const baselineBody = document.getElementById('baseline-specs-body');
            formData.baselineRows = [];
            if (baselineBody) {
                baselineBody.querySelectorAll('tr').forEach(row => {
                    const inputs = row.querySelectorAll('input');
                    formData.baselineRows.push({
                        module: inputs[0]?.value || '',
                        ip: inputs[1]?.value || '',
                        cpu: inputs[2]?.value || '',
                        ram: inputs[3]?.value || '',
                        cint: inputs[4]?.value || ''
                    });
                });
            }
            
            // Lưu ảnh sở cứ (evidence)
            formData.evidenceImages = getImagesFromContainer('container-evidence');
            break;
            
        case 'model':
            // Lưu ảnh mô hình vật lý
            formData.physicalImages = getImagesFromContainer('container-physical');
            // Lưu ảnh mô hình logic
            formData.logicalImages = getImagesFromContainer('container-logical');
            // Lưu ảnh kiến trúc
            formData.architectureImages = getImagesFromContainer('container-architecture');
            // Lưu ảnh luồng nghiệp vụ
            formData.flowImages = getImagesFromContainer('container-flow');
            // Lưu giải thích luồng nghiệp vụ
            const flowExplanation = document.getElementById('flow-explanation');
            formData.flowExplanation = flowExplanation?.value || '';
            
            // Lưu bảng chi tiết zone mạng (arch-table-body)
            const archBody = document.getElementById('arch-table-body');
            formData.archRows = [];
            if (archBody) {
                archBody.querySelectorAll('tr').forEach(row => {
                    const inputs = row.querySelectorAll('input, textarea');
                    formData.archRows.push({
                        module: inputs[0]?.value || '',
                        zone: inputs[1]?.value || '',
                        os: inputs[2]?.value || '',
                        vip: inputs[3]?.value || ''
                    });
                });
            }
            break;
            
        case 'summary':
            const summaryBody = document.getElementById('summary-table-body');
            formData.summaryRows = [];
            if (summaryBody) {
                summaryBody.querySelectorAll('tr').forEach(row => {
                    const inputs = row.querySelectorAll('input, textarea');
                    formData.summaryRows.push({
                        module: inputs[0]?.value || '',
                        soLuong: inputs[1]?.value || '',
                        vCPU: inputs[2]?.value || '',
                        ram: inputs[3]?.value || '',
                        volume: inputs[4]?.value || '',
                        ghiChu: inputs[5]?.value || ''
                    });
                });
            }
            break;
    }
    
    localStorage.setItem(`formCache_${pageId}`, JSON.stringify(formData));
    console.log(`Saved cache for ${pageId}:`, formData);
}

// Khôi phục form data từ cache
function restoreFormCache(pageId) {
    const cached = localStorage.getItem(`formCache_${pageId}`);
    if (!cached) return;
    
    try {
        const formData = JSON.parse(cached);
        
        switch(pageId) {
            case 'request':
                const requestInputs = document.querySelectorAll('.form-grid input');
                if (requestInputs.length >= 9) {
                    requestInputs[0].value = formData.devUnit || '';
                    requestInputs[1].value = formData.projectName || '';
                    requestInputs[2].value = formData.sysFeature || '';
                    requestInputs[3].value = formData.contactPerson || '';
                    requestInputs[4].value = formData.sizingPurpose || '';
                    requestInputs[5].value = formData.sizingBasis || '';
                    requestInputs[6].value = formData.sizingRule || '';
                    requestInputs[7].value = formData.importance || '';
                    requestInputs[8].value = formData.deploymentTime || '';
                }
                break;
                
            case 'input':
                // Khôi phục bảng thông tin đầu vào
                if (formData.inputRows && formData.inputRows.length > 0) {
                    const inputTableBody = document.getElementById('input-table-body');
                    if (inputTableBody) {
                        inputTableBody.innerHTML = '';
                        formData.inputRows.forEach((rowData, index) => {
                            const newRow = document.createElement('tr');
                            newRow.innerHTML = `
                                <td>${index + 1}</td>
                                <td><input type="text" value="${rowData.dauVao || ''}"></td>
                                <td><input type="text" value="${rowData.taiPOC || ''}"></td>
                                <td><input type="text" value="${rowData.dinhCo || ''}"></td>
                                <td><input type="text" value="${rowData.module || ''}"></td>
                                <td><textarea rows="1">${rowData.ghiChu || ''}</textarea></td>
                                <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
                            `;
                            inputTableBody.appendChild(newRow);
                        });
                    }
                }
                
                // Khôi phục bảng hệ thống tham chiếu
                if (formData.baselineRows && formData.baselineRows.length > 0) {
                    const baselineBody = document.getElementById('baseline-specs-body');
                    if (baselineBody) {
                        baselineBody.innerHTML = '';
                        formData.baselineRows.forEach(rowData => {
                            const newRow = document.createElement('tr');
                            newRow.innerHTML = `
                                <td><input type="text" value="${rowData.module || ''}"></td>
                                <td><input type="text" value="${rowData.ip || ''}"></td>
                                <td><input type="text" value="${rowData.cpu || ''}"></td>
                                <td><input type="number" class="ram-val" value="${rowData.ram || ''}" oninput="calculateBaselineTotal()"></td>
                                <td><input type="number" class="cint-val" value="${rowData.cint || ''}" oninput="calculateBaselineTotal()"></td>
                                <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();">✖</button></td>
                            `;
                            baselineBody.appendChild(newRow);
                        });
                        // Tính lại tổng
                        setTimeout(() => calculateBaselineTotal(), 100);
                    }
                }
                
                // Khôi phục ảnh sở cứ
                if (formData.evidenceImages && formData.evidenceImages.length > 0) {
                    restoreImagesToContainer('container-evidence', formData.evidenceImages);
                }
                break;
            
            case 'model':
                // Khôi phục ảnh mô hình vật lý
                if (formData.physicalImages && formData.physicalImages.length > 0) {
                    restoreImagesToContainer('container-physical', formData.physicalImages);
                }
                // Khôi phục ảnh mô hình logic
                if (formData.logicalImages && formData.logicalImages.length > 0) {
                    restoreImagesToContainer('container-logical', formData.logicalImages);
                }
                // Khôi phục ảnh kiến trúc
                if (formData.architectureImages && formData.architectureImages.length > 0) {
                    restoreImagesToContainer('container-architecture', formData.architectureImages);
                }
                // Khôi phục ảnh luồng nghiệp vụ
                if (formData.flowImages && formData.flowImages.length > 0) {
                    restoreImagesToContainer('container-flow', formData.flowImages);
                }
                // Khôi phục giải thích luồng nghiệp vụ
                const flowExplanation = document.getElementById('flow-explanation');
                if (flowExplanation && formData.flowExplanation) {
                    flowExplanation.value = formData.flowExplanation;
                }
                
                // Khôi phục bảng chi tiết zone mạng
                if (formData.archRows && formData.archRows.length > 0) {
                    const archBody = document.getElementById('arch-table-body');
                    if (archBody) {
                        archBody.innerHTML = '';
                        formData.archRows.forEach((rowData, index) => {
                            const newRow = document.createElement('tr');
                            newRow.innerHTML = `
                                <td>${index + 1}</td>
                                <td><input type="text" value="${rowData.module || ''}"></td>
                                <td><input type="text" value="${rowData.zone || ''}"></td>
                                <td><input type="text" value="${rowData.os || ''}"></td>
                                <td><textarea rows="1">${rowData.vip || ''}</textarea></td>
                                <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
                            `;
                            archBody.appendChild(newRow);
                        });
                    }
                }
                break;
                
            case 'summary':
                if (formData.summaryRows && formData.summaryRows.length > 0) {
                    const summaryBody = document.getElementById('summary-table-body');
                    if (summaryBody) {
                        summaryBody.innerHTML = '';
                        formData.summaryRows.forEach((rowData, index) => {
                            const newRow = document.createElement('tr');
                            newRow.innerHTML = `
                                <td>${index + 1}</td>
                                <td><input type="text" value="${rowData.module || ''}"></td>
                                <td><input type="number" value="${rowData.soLuong || '1'}"></td>
                                <td><input type="number" value="${rowData.vCPU || '1'}"></td>
                                <td><input type="text" value="${rowData.ram || ''}"></td>
                                <td><input type="text" value="${rowData.volume || ''}"></td>
                                <td><textarea rows="1">${rowData.ghiChu || ''}</textarea></td>
                                <td><button type="button" class="btn-delete" onclick="removeSummaryRow(this)">✖</button></td>
                            `;
                            summaryBody.appendChild(newRow);
                        });
                    }
                }
                break;
        }
        
        console.log(`Restored cache for ${pageId}`);
    } catch (e) {
        console.error('Error restoring cache:', e);
    }
}

// ========== HÀM ĐỒNG BỘ DỮ LIỆU TỪ DATABASE ==========

// Fetch dữ liệu từ DB và populate vào form
async function loadDataFromDB(pageId) {
    if (!currentSystemInfoId) return false;
    
    try {
        switch(pageId) {
            case 'request':
                // Fetch thông tin SystemInfo
                const sysResponse = await fetch(`${API_BASE_URL}/system-info/${currentSystemInfoId}`);
                if (sysResponse.ok) {
                    const sysData = await sysResponse.json();
                    const requestInputs = document.querySelectorAll('.form-grid input');
                    if (requestInputs.length >= 9) {
                        requestInputs[0].value = sysData.devUnit || '';
                        requestInputs[1].value = sysData.projectName || '';
                        requestInputs[2].value = sysData.sysFeature || '';
                        requestInputs[3].value = sysData.contactPerson || '';
                        requestInputs[4].value = sysData.sizingPurpose || '';
                        requestInputs[5].value = sysData.sizingBasis || '';
                        requestInputs[6].value = sysData.sizingRule || '';
                        requestInputs[7].value = sysData.importance || '';
                        requestInputs[8].value = sysData.deploymentTime || '';
                    }
                    // Cập nhật cache từ DB
                    saveFormCache('request');
                    return true;
                }
                break;
                
            case 'input':
                // Fetch ThongTinDauVao
                const inputResponse = await fetch(`${API_BASE_URL}/thong-tin-dau-vao/system-info/${currentSystemInfoId}`);
                if (inputResponse.ok) {
                    const inputData = await inputResponse.json();
                    if (inputData && inputData.length > 0) {
                        const inputTableBody = document.getElementById('input-table-body');
                        if (inputTableBody) {
                            inputTableBody.innerHTML = '';
                            inputData.forEach((item, index) => {
                                const newRow = document.createElement('tr');
                                newRow.innerHTML = `
                                    <td>${index + 1}</td>
                                    <td><input type="text" value="${item.dauVao || ''}"></td>
                                    <td><input type="text" value="${item.taiPOC || ''}"></td>
                                    <td><input type="text" value="${item.dinhCo || ''}"></td>
                                    <td><input type="text" value="${item.module || ''}"></td>
                                    <td><textarea rows="1">${item.ghiChu || ''}</textarea></td>
                                    <td><button class="btn-delete" onclick="removeRow(this)">✖</button></td>
                                `;
                                inputTableBody.appendChild(newRow);
                            });
                        }
                    }
                }
                
                // Fetch HeThongThamChieu
                const baselineResponse = await fetch(`${API_BASE_URL}/he-thong-tham-chieu/system-info/${currentSystemInfoId}`);
                if (baselineResponse.ok) {
                    const baselineData = await baselineResponse.json();
                    if (baselineData && baselineData.length > 0) {
                        const baselineBody = document.getElementById('baseline-specs-body');
                        if (baselineBody) {
                            baselineBody.innerHTML = '';
                            baselineData.forEach(item => {
                                const newRow = document.createElement('tr');
                                newRow.innerHTML = `
                                    <td><input type="text" value="${item.module || ''}"></td>
                                    <td><input type="text" value="${item.ip || ''}"></td>
                                    <td><input type="text" value="${item.cpu || ''}"></td>
                                    <td><input type="number" class="ram-val" value="${item.ram || ''}" oninput="calculateBaselineTotal()"></td>
                                    <td><input type="number" class="cint-val" value="${item.cint || ''}" oninput="calculateBaselineTotal()"></td>
                                    <td><button type="button" class="btn-delete" onclick="this.closest('tr').remove(); calculateBaselineTotal();">✖</button></td>
                                `;
                                baselineBody.appendChild(newRow);
                            });
                            setTimeout(() => calculateBaselineTotal(), 100);
                        }
                    }
                }
                
                // Fetch ảnh sở cứ từ DB
                const evidenceResponse = await fetch(`${API_BASE_URL}/so-cu-thong-tin-dau-vao/system-info/${currentSystemInfoId}`);
                if (evidenceResponse.ok) {
                    const evidenceData = await evidenceResponse.json();
                    if (evidenceData && evidenceData.length > 0) {
                        const container = document.getElementById('container-evidence');
                        if (container) {
                            evidenceData.forEach(item => {
                                if (item.imagePath) {
                                    restoreImageFromPath('container-evidence', item.imagePath);
                                }
                            });
                        }
                    }
                }
                
                // Cập nhật cache từ DB
                saveFormCache('input');
                return true;
            
            case 'model':
                // Fetch ảnh mô hình hệ thống từ DB
                const modelImageResponse = await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}`);
                if (modelImageResponse.ok) {
                    const modelImageData = await modelImageResponse.json();
                    if (modelImageData) {
                        // Mô hình vật lý
                        if (modelImageData.moHinhVatLy) {
                            restoreImageFromPath('container-physical', modelImageData.moHinhVatLy);
                        }
                        // Mô hình logic
                        if (modelImageData.moHinhLogic) {
                            restoreImageFromPath('container-logical', modelImageData.moHinhLogic);
                        }
                        // Luồng nghiệp vụ
                        if (modelImageData.luongNghiepVu) {
                            restoreImageFromPath('container-flow', modelImageData.luongNghiepVu);
                        }
                        // Giải thích luồng nghiệp vụ
                        if (modelImageData.luongNghiepVuDescription) {
                            const flowExplanation = document.getElementById('flow-explanation');
                            if (flowExplanation) {
                                flowExplanation.value = modelImageData.luongNghiepVuDescription;
                            }
                        }
                    }
                }
                
                // Fetch chi tiết zone mạng từ DB
                const zoneResponse = await fetch(`${API_BASE_URL}/mo-hinh-he-thong/system-info/${currentSystemInfoId}`);
                if (zoneResponse.ok) {
                    const zoneData = await zoneResponse.json();
                    if (zoneData && zoneData.length > 0) {
                        const archBody = document.getElementById('arch-table-body');
                        if (archBody) {
                            archBody.innerHTML = '';
                            zoneData.forEach((item, index) => {
                                const newRow = document.createElement('tr');
                                newRow.innerHTML = `
                                    <td>${index + 1}</td>
                                    <td><input type="text" value="${item.module || ''}"></td>
                                    <td><input type="text" value="${item.zoneMang || ''}"></td>
                                    <td><input type="text" value="${item.heDieuHanh || ''}"></td>
                                    <td><textarea rows="1">${item.soLuongVIP || ''}</textarea></td>
                                    <td><button type="button" class="btn-delete" onclick="removeArchRow(this)">✖</button></td>
                                `;
                                archBody.appendChild(newRow);
                            });
                        }
                    }
                }
                
                // Cập nhật cache từ DB
                saveFormCache('model');
                return true;
                
            case 'summary':
                // Fetch TongHop
                const summaryResponse = await fetch(`${API_BASE_URL}/tong-hop/system-info/${currentSystemInfoId}`);
                if (summaryResponse.ok) {
                    const summaryData = await summaryResponse.json();
                    if (summaryData && summaryData.length > 0) {
                        const summaryBody = document.getElementById('summary-table-body');
                        if (summaryBody) {
                            summaryBody.innerHTML = '';
                            summaryData.forEach((item, index) => {
                                const newRow = document.createElement('tr');
                                newRow.innerHTML = `
                                    <td>${index + 1}</td>
                                    <td><input type="text" value="${item.module || ''}"></td>
                                    <td><input type="number" value="${item.soLuong || 1}"></td>
                                    <td><input type="number" value="${item.vCpu || item.vCPU || 1}"></td>
                                    <td><input type="text" value="${item.ram || ''}"></td>
                                    <td><input type="text" value="${item.volume || ''}"></td>
                                    <td><textarea rows="1">${item.ghiChu || ''}</textarea></td>
                                    <td><button type="button" class="btn-delete" onclick="removeSummaryRow(this)">✖</button></td>
                                `;
                                summaryBody.appendChild(newRow);
                            });
                        }
                        // Cập nhật cache từ DB
                        saveFormCache('summary');
                        return true;
                    }
                }
                break;
        }
    } catch (error) {
        console.error(`Error loading data from DB for ${pageId}:`, error);
    }
    
    return false;
}

// Thêm auto-save listeners cho các input trong form
function setupAutoSaveListeners(pageId) {
    const container = document.getElementById('main-display');
    if (!container) return;
    
    // Lắng nghe sự kiện input trên tất cả inputs và textareas
    container.querySelectorAll('input, textarea').forEach(element => {
        element.addEventListener('input', () => {
            // Debounce: lưu sau 500ms không có thay đổi
            clearTimeout(window.autoSaveTimeout);
            window.autoSaveTimeout = setTimeout(() => {
                saveFormCache(pageId);
            }, 500);
        });
    });
}

// Cập nhật hiển thị trạng thái project
function updateProjectStatusDisplay() {
    let statusBar = document.getElementById('project-status-bar');
    
    if (!statusBar) {
        // Tạo status bar nếu chưa có
        statusBar = document.createElement('div');
        statusBar.id = 'project-status-bar';
        statusBar.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            background: linear-gradient(135deg, #1a5276, #2e86ab);
            color: white;
            padding: 8px 15px;
            font-size: 12px;
            z-index: 9999;
            border-bottom-left-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        document.body.appendChild(statusBar);
    }
    
    if (currentSystemInfoId) {
        statusBar.innerHTML = `
            <span style="background: #27ae60; padding: 3px 8px; border-radius: 4px;">●</span>
            <span>Project ID: <strong>${currentSystemInfoId}</strong></span>
            <button onclick="clearAllCacheAndCreateNew()" style="
                background: #e74c3c;
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">+ Tạo dự án mới</button>
        `;
    } else {
        statusBar.innerHTML = `
            <span style="background: #f39c12; padding: 3px 8px; border-radius: 4px;">○</span>
            <span>Chưa có dự án - Hãy lưu "Yêu cầu bài toán" để bắt đầu</span>
        `;
    }
}

document.addEventListener("DOMContentLoaded", function () {
    // Log ID hiện tại khi load trang
    console.log('Current SystemInfo ID from localStorage:', currentSystemInfoId);
    
    // Hiển thị status bar project
    updateProjectStatusDisplay();
    
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
                        <img src="hinhanh.img/vatly.png" alt="Mẫu Vật lý">
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
            <div id="model-save-status" style="margin-top: 10px;"></div>
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

        <div style="margin-top: 30px; text-align: center;">
            <button type="button" class="btn-submit" id="saveSummaryBtn" style="margin-right: 10px;">
                <i class="fa-solid fa-floppy-disk"></i> Lưu dữ liệu
            </button>
            <button type="button" class="btn-submit" id="exportBtn">
                <i class="fa-solid fa-file-word"></i> XUẤT BÁO CÁO (WORD)
            </button>
            <div id="summary-save-status" style="margin-top: 10px;"></div>
        </div>
    </div>
`,
    };

    const contentArea = document.getElementById('main-display');
    const menuLinks = document.querySelectorAll('.side-menu a');

    menuLinks.forEach(link => {
    link.addEventListener('click', async function (e) {
        e.preventDefault();
        const pageId = this.getAttribute('data-page');

        if (contentArea && pageContent[pageId]) {
            contentArea.innerHTML = pageContent[pageId];
            
            // Lưu pageId hiện tại để auto-save
            currentPageId = pageId;

            // Chờ một chút để DOM kịp cập nhật HTML mới
            setTimeout(async () => {
                // Ưu tiên load dữ liệu từ DB nếu có systemInfoId
                let loadedFromDB = false;
                if (currentSystemInfoId) {
                    loadedFromDB = await loadDataFromDB(pageId);
                }
                
                // Nếu không load được từ DB, thử khôi phục từ cache
                if (!loadedFromDB) {
                    restoreFormCache(pageId);
                }
                
                // Thiết lập auto-save
                setupAutoSaveListeners(pageId);
                
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
                    
                    // Thêm sự kiện cho nút Lưu mô hình hệ thống
                    const saveModelBtn = document.getElementById('saveModelBtn');
                    if (saveModelBtn) {
                        saveModelBtn.onclick = saveModelData;
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
                            
                            // Thêm auto-save listeners cho dòng mới
                            newRow.querySelectorAll('input, textarea').forEach(element => {
                                element.addEventListener('input', () => {
                                    clearTimeout(window.autoSaveTimeout);
                                    window.autoSaveTimeout = setTimeout(() => {
                                        saveFormCache('summary');
                                    }, 500);
                                });
                            });
                            
                            // Lưu cache ngay sau khi thêm dòng
                            saveFormCache('summary');
                        };
                    }
                    // Thêm sự kiện cho nút lưu dữ liệu
                    const saveSummaryBtn = document.getElementById('saveSummaryBtn');
                    if (saveSummaryBtn) {
                        saveSummaryBtn.onclick = saveSummaryData;
                    }
                    // Thêm sự kiện cho nút xuất báo cáo
                    const exportBtn = document.getElementById('exportBtn');
                    if (exportBtn) {
                        exportBtn.onclick = exportToWord;
                    }
                }

                // 5. Logic trang ĐỊNH CỠ HỆ THỐNG (Sizing)
                if (pageId === 'sizing') {
                    // Cập nhật iframe URL với systemInfoId
                    const sizingIframe = document.getElementById('sizing-iframe');
                    if (sizingIframe && currentSystemInfoId) {
                        sizingIframe.src = `http://localhost:8503?systemInfoId=${currentSystemInfoId}`;
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
    
    // Lưu cache sau khi xóa dòng
    saveFormCache('input');
}
function removeSummaryRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    
    // Cập nhật lại STT
    Array.from(tbody.rows).forEach((r, index) => {
        r.cells[0].innerText = index + 1;
    });
    
    // Lưu cache sau khi xóa dòng
    saveFormCache('summary');
}
function removeArchRow(btn) {
    const row = btn.closest('tr');
    const tbody = row.parentElement;
    row.remove();
    // Cập nhật lại STT
    Array.from(tbody.rows).forEach((r, index) => {
        r.cells[0].innerText = index + 1;
    });
    
    // Lưu cache sau khi xóa dòng
    saveFormCache('model');
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
            <button type="button" class="btn-remove-img" onclick="document.getElementById('${boxId}').remove(); saveFormCacheForCurrentPage();">✖</button>
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
            // Auto-save cache sau khi upload ảnh
            setTimeout(() => saveFormCacheForCurrentPage(), 100);
        };
        reader.readAsDataURL(input.files[0]);
    }
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

// ========== HÀM LƯU MÔ HÌNH HỆ THỐNG ==========

// Hàm lưu mô hình hệ thống (ảnh + bảng chi tiết zone mạng)
async function saveModelData() {
    const statusDiv = document.getElementById('model-save-status');
    
    // Kiểm tra xem đã có SystemInfo ID chưa
    if (!currentSystemInfoId) {
        alert('Vui lòng lưu thông tin "Yêu cầu bài toán" trước!');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Chưa có SystemInfo ID. Hãy lưu Yêu cầu bài toán trước!</span>';
        }
        return;
    }
    
    try {
        let uploadedImages = 0;
        let savedZoneRows = 0;
        let errorCount = 0;
        
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu dữ liệu...</span>';
        }
        
        // 1. Upload ảnh Mô hình Vật lý
        const physicalBoxes = document.querySelectorAll('#container-physical .upload-box');
        for (const box of physicalBoxes) {
            const fileInput = box.querySelector('input[type="file"]');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                
                try {
                    const response = await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}/mo-hinh-vat-ly`, {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) uploadedImages++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error uploading physical model image:', e);
                }
            }
        }
        
        // 2. Upload ảnh Mô hình Logic
        const logicalBoxes = document.querySelectorAll('#container-logical .upload-box');
        for (const box of logicalBoxes) {
            const fileInput = box.querySelector('input[type="file"]');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                
                try {
                    const response = await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}/mo-hinh-logic`, {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) uploadedImages++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error uploading logical model image:', e);
                }
            }
        }
        
        // 3. Upload ảnh Luồng nghiệp vụ
        const flowBoxes = document.querySelectorAll('#container-flow .upload-box');
        for (const box of flowBoxes) {
            const fileInput = box.querySelector('input[type="file"]');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                
                try {
                    const response = await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}/luong-nghiep-vu`, {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) uploadedImages++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error uploading business flow image:', e);
                }
            }
        }
        
        // 4. Lưu mô tả luồng nghiệp vụ
        const flowDescription = document.getElementById('flow-explanation')?.value;
        if (flowDescription && flowDescription.trim()) {
            try {
                const response = await fetch(`${API_BASE_URL}/mo-hinh-he-thong-image/system-info/${currentSystemInfoId}/luong-nghiep-vu-description`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(flowDescription)
                });
                if (response.ok) {
                    console.log('Saved flow description');
                } else {
                    errorCount++;
                }
            } catch (e) {
                errorCount++;
                console.error('Error saving flow description:', e);
            }
        }
        
        // 5. Lưu bảng chi tiết zone mạng, hệ điều hành, số lượng VIP
        const archRows = document.querySelectorAll('#arch-table-body tr');
        for (const row of archRows) {
            const cells = row.querySelectorAll('td');
            const moduleInput = cells[1]?.querySelector('input');
            const zoneInput = cells[2]?.querySelector('input');
            const osInput = cells[3]?.querySelector('input');
            const vipTextarea = cells[4]?.querySelector('textarea');
            
            const data = {
                module: moduleInput?.value || '',
                zoneMang: zoneInput?.value || '',
                heDieuHanh: osInput?.value || '',
                soLuongVIP: parseInt(vipTextarea?.value) || 0
            };
            
            // Chỉ lưu nếu có ít nhất module
            if (data.module) {
                try {
                    const response = await fetch(`${API_BASE_URL}/mo-hinh-he-thong/system-info/${currentSystemInfoId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (response.ok) savedZoneRows++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error saving zone info:', e);
                }
            }
        }
        
        // Hiển thị kết quả
        const message = `Đã lưu mô hình hệ thống:
- ${uploadedImages} ảnh mô hình
- ${savedZoneRows} dòng thông tin zone/module
${errorCount > 0 ? `\nCó ${errorCount} lỗi xảy ra.` : ''}`;

        if (errorCount === 0) {
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công: ${uploadedImages} ảnh, ${savedZoneRows} dòng thông tin</span>`;
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

// ========== HÀM LƯU TỔNG HỢP VÀ ĐỀ XUẤT ==========

// Hàm lưu dữ liệu tổng hợp và đề xuất
async function saveSummaryData() {
    const statusDiv = document.getElementById('summary-save-status');
    
    // Kiểm tra xem đã có SystemInfo ID chưa
    if (!currentSystemInfoId) {
        alert('Vui lòng lưu thông tin "Yêu cầu bài toán" trước!');
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: red;">✗ Chưa có SystemInfo ID. Hãy lưu Yêu cầu bài toán trước!</span>';
        }
        return;
    }
    
    try {
        let savedRows = 0;
        let errorCount = 0;
        
        if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: blue;">⏳ Đang lưu dữ liệu...</span>';
        }
        
        // Lưu các dòng trong bảng tổng hợp đề xuất
        const summaryRows = document.querySelectorAll('#summary-table-body tr');
        for (const row of summaryRows) {
            const cells = row.querySelectorAll('td');
            
            const data = {
                module: cells[1]?.querySelector('input')?.value || '',
                soLuong: parseInt(cells[2]?.querySelector('input')?.value) || 1,
                vCPU: parseInt(cells[3]?.querySelector('input')?.value) || 1,
                ram: parseFloat(cells[4]?.querySelector('input')?.value) || 0,
                volume: cells[5]?.querySelector('input')?.value || '',
                ghiChu: cells[6]?.querySelector('textarea')?.value || ''
            };
            
            // Chỉ lưu nếu có ít nhất module
            if (data.module) {
                try {
                    const response = await fetch(`${API_BASE_URL}/tong-hop/system-info/${currentSystemInfoId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    if (response.ok) savedRows++;
                    else errorCount++;
                } catch (e) {
                    errorCount++;
                    console.error('Error saving summary row:', e);
                }
            }
        }
        
        // Hiển thị kết quả
        const message = `Đã lưu ${savedRows} dòng tổng hợp đề xuất${errorCount > 0 ? `\nCó ${errorCount} lỗi xảy ra.` : ''}`;

        if (errorCount === 0) {
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: green;">✓ Lưu thành công: ${savedRows} dòng đề xuất</span>`;
            }
        } else {
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: orange;">⚠ Đã lưu ${savedRows} dòng, có ${errorCount} lỗi</span>`;
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
    const statusDiv = document.getElementById('summary-save-status');
    
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