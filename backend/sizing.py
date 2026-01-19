import streamlit as st
import pandas as pd
from docx import Document
from io import BytesIO
from datetime import datetime
import math
import requests

# --- CẤU HÌNH HỆ THỐNG ---
BACKEND_API_URL = "http://localhost:8081/api"

# --- HÀM HỖ TRỢ ---
def save_redis_sizing(system_info_id, redis_data):
    """Gửi dữ liệu sizing Redis xuống Backend API"""
    try:
        url = f"{BACKEND_API_URL}/redis/system-info/{system_info_id}"
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, json=redis_data, headers=headers)
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, response.text
    except Exception as e:
        return False, str(e)

# --- THIẾT LẬP TRANG ---
st.set_page_config(page_title="Cong cu Dinh co Ha tang", layout="wide")

# --- CSS TÙY CHỈNH (SLIDER MÀU ĐỎ & GIAO DIỆN CARD) ---
st.markdown("""
<style>
    /* Font chữ */
    html, body, [class*="css"] {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    /* Header Style */
    .header-style {
        background-color: #2c3e50;
        padding: 20px;
        border-radius: 8px;
        color: white;
        margin-bottom: 25px;
        border-left: 5px solid #e74c3c; /* Màu đỏ làm điểm nhấn */
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    /* TÙY CHỈNH SLIDER MÀU ĐỎ NHƯ TRONG ẢNH */
    div.stSlider > div[data-baseweb = "slider"] > div > div > div[role="slider"]{
        background-color: #ff4b4b !important; /* Nút kéo màu đỏ */
        box-shadow: 0 0 5px rgba(255, 75, 75, 0.5);
    }
    div.stSlider > div[data-baseweb = "slider"] > div > div > div > div {
        background-color: #ff4b4b !important; /* Thanh trượt màu đỏ */
    }
    
    /* Style cho Card Server */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border: 1px solid #ddd;
        border-radius: 8px;
        background-color: white;
        padding: 15px;
        margin-bottom: 10px;
    }
    
    /* Input field tinh chỉnh */
    .stTextInput input, .stNumberInput input {
        background-color: #f8f9fa;
    }
</style>
""", unsafe_allow_html=True)

# --- KHỞI TẠO SESSION STATE CHO DANH SÁCH SERVER ---
# Đây là phần quan trọng để lưu danh sách server khi thêm/xóa
if "servers" not in st.session_state:
    st.session_state.servers = [
        {"ip": "10.207.252.1", "vcpu": 32, "ram": 64, "cpu_load": 30, "ram_load": 80}
    ]

def add_server():
    idx = len(st.session_state.servers) + 1
    st.session_state.servers.append({
        "ip": f"10.207.252.{idx}", 
        "vcpu": 32, 
        "ram": 64, 
        "cpu_load": 30, 
        "ram_load": 80
    })

def remove_server(index):
    if len(st.session_state.servers) > 0:
        st.session_state.servers.pop(index)

# --- HEADER ---
st.markdown("""
<div class="header-style">
    <h2 style="margin:0; font-size: 24px;">CÔNG CỤ ĐỊNH CỠ HẠ TẦNG (SIZING TOOL)</h2>
    <p style="margin:5px 0 0 0; font-size: 14px; opacity: 0.9;">Hỗ trợ tính toán tài nguyên Oracle RAC, Redis, MariaDB...</p>
</div>
""", unsafe_allow_html=True)

# --- SIDEBAR ---
with st.sidebar:
    st.header("Cấu hình chung")
    
    query_params = st.query_params
    url_sys_id = query_params.get("systemInfoId", "")
    if url_sys_id:
        system_info_id = url_sys_id
        st.info(f"Mã hệ thống: {system_info_id}")
    else:
        system_info_id = st.text_input("Mã hệ thống (SystemInfo ID)")

    st.divider()
    
    db_type = st.selectbox(
        "Loại Cơ sở dữ liệu",
        ["Oracle RAC", "MariaDB MaxScale", "PostgreSQL", "Redis", "MongoDB"]
    )

    st.divider()
    
    with st.expander("Tham số An toàn", expanded=True):
        growth_factor = st.slider("Hệ số Tăng trưởng (Growth)", 1.0, 2.0, 1.1, 0.1)
        cpu_threshold = st.slider("Ngưỡng CPU tối đa", 0.5, 1.0, 0.75, 0.05)
        ram_threshold = st.slider("Ngưỡng RAM tối đa", 0.5, 1.0, 0.90, 0.05)
        disk_threshold = st.slider("Ngưỡng Disk tối đa", 0.5, 1.0, 0.80, 0.05)

# ==========================================
# GIAO DIỆN CHÍNH
# ==========================================

if db_type == "Redis":
    st.info("")

else:
    # --- GIAO DIỆN ORACLE RAC / DB THƯỜNG ---
    
    col_input, col_result = st.columns([1.2, 0.8], gap="large")
    
    # === CỘT TRÁI: NHẬP LIỆU BASELINE ===
    with col_input:
        st.subheader("A. Hệ thống Tham chiếu (Baseline)")
        
        # 1. Thông tin CCU
        with st.container(border=True):
            c1, c2 = st.columns(2)
            current_ccu = c1.number_input("CCU Hiện tại", value=100)
            target_ccu = c2.number_input("CCU Mục tiêu", value=200)
            scale_ratio = target_ccu / current_ccu
            st.caption(f"Tỉ lệ Scale: **{scale_ratio:.2f}x**")

        st.markdown("#### Danh sách Server hiện tại")
        
        # 2. VÒNG LẶP HIỂN THỊ SERVER CARD (GIỐNG ẢNH)
        # Sử dụng st.session_state.servers để render từng card
        
        for i, server in enumerate(st.session_state.servers):
            # Tạo khung viền cho từng server
            with st.container(border=True):
                # Header của Card: Tên Server + Nút Xóa
                head_col1, head_col2 = st.columns([0.85, 0.15])
                head_col1.markdown(f"**Server {i + 1}**")
                if head_col2.button("🗑️", key=f"btn_del_{i}", help="Xóa server này"):
                    remove_server(i)
                    st.rerun()

                # Dòng 1: IP, vCPU, RAM
                row1 = st.columns([2, 1, 1])
                server["ip"] = row1[0].text_input(f"IP Sv{i+1}", value=server["ip"], key=f"ip_{i}")
                server["vcpu"] = row1[1].number_input(f"vCPU Sv{i+1}", value=server["vcpu"], key=f"cpu_{i}")
                server["ram"] = row1[2].number_input(f"RAM(GB) Sv{i+1}", value=server["ram"], key=f"ram_{i}")

                # Dòng 2: Slider CPU & RAM (Màu đỏ do CSS ở trên)
                row2 = st.columns(2)
                
                # Slider CPU
                server["cpu_load"] = row2[0].slider(
                    f"% CPU Used Sv{i+1}", 
                    0, 100, server["cpu_load"], 
                    key=f"sld_cpu_{i}"
                )
                
                # Slider RAM
                server["ram_load"] = row2[1].slider(
                    f"% RAM Used Sv{i+1}", 
                    0, 100, server["ram_load"], 
                    key=f"sld_ram_{i}"
                )

        # Nút chức năng quản lý danh sách
        btn_col1, btn_col2 = st.columns([1, 1])
        if btn_col1.button("➕ Thêm Server", type="secondary", use_container_width=True):
            add_server()
            st.rerun()
            
        st.markdown("---")
        st.markdown("#### Thông tin Lưu trữ (Storage)")
        with st.container(border=True):
            sd1, sd2 = st.columns(2)
            current_storage_used_data = sd1.number_input("Data Used (GB)", value=500)
            current_storage_used_log = sd2.number_input("Log Used (GB)", value=100)
            current_storage_used_backup = st.number_input("Backup Full (GB)", value=500)

    # === CỘT PHẢI: KẾT QUẢ TÍNH TOÁN ===
    with col_result:
        st.subheader("B. Kết quả & Đề xuất")
        
        with st.container(border=True):
            st.markdown("##### Cấu hình Mục tiêu")
            min_node = 2 if db_type == "Oracle RAC" else 1
            proposed_n = st.number_input("Số Node đề xuất:", min_value=min_node, value=max(len(st.session_state.servers), min_node))
            
            calc_btn = st.button("TÍNH TOÁN SIZING", type="primary", use_container_width=True)

        if calc_btn:
            # 1. Tính tổng tài nguyên đang dùng (Baseline) từ Session State
            total_cpu_used = 0
            total_ram_used = 0
            
            for s in st.session_state.servers:
                total_cpu_used += s["vcpu"] * (s["cpu_load"] / 100)
                total_ram_used += s["ram"] * (s["ram_load"] / 100)

            # 2. Tính nhu cầu (Requirements)
            req_cpu = (total_cpu_used * scale_ratio * growth_factor) / cpu_threshold
            req_ram = (total_ram_used * scale_ratio * growth_factor) / ram_threshold
            
            req_disk_data = (current_storage_used_data * scale_ratio * growth_factor) / disk_threshold
            req_disk_log = (current_storage_used_log * scale_ratio * growth_factor) / disk_threshold
            
            # 3. Chia cho số node mới
            per_node_cpu = math.ceil(math.ceil(req_cpu) / proposed_n)
            per_node_ram = math.ceil(math.ceil(req_ram) / proposed_n)
            
            # Logic hiển thị Storage
            is_shared = db_type == "Oracle RAC"
            storage_txt = f"{math.ceil(req_disk_data)} GB (Shared)" if is_shared else f"{math.ceil(req_disk_data)} GB (Mỗi Node)"

            # 4. Hiển thị Kết quả
            st.success(f"✅ Kết quả tính toán cho {db_type} ({proposed_n} Node)")
            
            with st.container(border=True):
                st.markdown("#### Cấu hình Mỗi Node")
                m1, m2 = st.columns(2)
                m1.metric("vCPU", f"{per_node_cpu} Core")
                m2.metric("RAM", f"{per_node_ram} GB")
                
                st.divider()
                st.markdown("#### Dung lượng Lưu trữ")
                m3, m4 = st.columns(2)
                m3.metric("Data Volume", storage_txt)
                m4.metric("Log Volume", f"{math.ceil(req_disk_log/proposed_n)} GB")

            # 5. Xuất báo cáo Word
            doc = Document()
            doc.add_heading(f'BÁO CÁO SIZING: {db_type.upper()}', 0)
            
            doc.add_heading('1. Thông tin Baseline', level=1)
            table = doc.add_table(rows=1, cols=3)
            table.style = 'Table Grid'
            hdr = table.rows[0].cells
            hdr[0].text = 'Server IP'
            hdr[1].text = 'vCPU (Used)'
            hdr[2].text = 'RAM (Used)'
            
            for s in st.session_state.servers:
                row = table.add_row().cells
                row[0].text = s['ip']
                row[1].text = f"{s['vcpu']} ({s['cpu_load']}%)"
                row[2].text = f"{s['ram']} ({s['ram_load']}%)"
            
            doc.add_heading('2. Kết quả Đề xuất', level=1)
            doc.add_paragraph(f"Tổng số Node: {proposed_n}")
            doc.add_paragraph(f"Cấu hình mỗi Node: {per_node_cpu} vCPU, {per_node_ram} GB RAM")
            
            b = BytesIO()
            doc.save(b)
            b.seek(0)
            st.download_button("📥 Tải báo cáo (.docx)", data=b, file_name=f"sizing_{db_type}.docx", use_container_width=True)
# --- TRƯỜNG HỢP 1: REDIS SIZING ---
if db_type == "Redis":
    
    # Layout 2 cột: Trái (Input) - Phải (Output)
    col_input, col_result = st.columns([1.2, 0.8], gap="medium")
    
    with col_input:
        st.subheader("Tham số Đầu vào")
        
        # Tab điều hướng nhập liệu
        tab_info, tab_sizing = st.tabs(["Thông tin Mô hình", "Số liệu Tính toán"])
        
        with tab_info:
            with st.container(border=True):
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("**1. Sơ đồ Logic (Diagram)**")
                    uploaded_logic_img = st.file_uploader("Tải lên sơ đồ", type=['png', 'jpg'])
                    if uploaded_logic_img:
                        st.image(uploaded_logic_img, use_container_width=True)
                with c2:
                    st.markdown("**2. Ảnh Minh họa (Tùy chọn)**")
                    uploaded_ref_img = st.file_uploader("Tải lên ảnh tham khảo", type=['png', 'jpg'])
                    if uploaded_ref_img:
                        st.image(uploaded_ref_img, use_container_width=True)

            with st.container(border=True):
                st.markdown("**3. Thông tin Nghiệp vụ**")
                redis_desc = st.text_area("Mô tả module", height=100, placeholder="Mô tả chức năng chính của module...")
                redis_purpose = st.text_area("Mục đích sử dụng", height=100, placeholder="Ví dụ: Cache, Session, Pub/Sub...")

        with tab_sizing:
            method = st.radio("Phương pháp tính toán", ["Theo số lượng Key (Khuyên dùng)", "Tuyến tính theo cấu hình cũ"], horizontal=True)
            
            redis_params = {}

            if "Key" in method:
                with st.container(border=True):
                    st.markdown("#### Chỉ số Key")
                    c_key1, c_key2 = st.columns(2)
                    
                    with c_key1:
                        key_count = st.number_input("Tổng số lượng Key (A)", min_value=1, value=1000000, step=100000, format="%d")
                        st.caption("Gợi ý: Dùng lệnh dbsize hoặc info keyspace")
                        uploaded_key_proof = st.file_uploader("Ảnh sở cứ (Số lượng Key)", type=['png', 'jpg'], key="kp")
                    
                    with c_key2:
                        avg_size_kb = st.number_input("Kích thước TB/Key (KB) (B)", min_value=0.0, value=2.0, step=0.1)
                        st.caption("Gợi ý: Dùng lệnh memory usage")
                        uploaded_size_proof = st.file_uploader("Ảnh sở cứ (Kích thước)", type=['png', 'jpg'], key="sp")

                with st.container(border=True):
                    st.markdown("#### Chiến lược Cluster")
                    c_clus1, c_clus2 = st.columns(2)
                    with c_clus1:
                        system_criticality = st.selectbox("Mức độ quan trọng", ["Thường (1 Master - 1 Slave)", "Đặc biệt quan trọng (1 Master - 2 Slave)"])
                    with c_clus2:
                        num_shards = st.number_input("Số Shard (Master) dự kiến (N)", min_value=1, value=3, step=2, help="Nên là số lẻ")

                redis_params = {
                    "method": "keys", "A": key_count, "B_KB": avg_size_kb,
                    "criticality": system_criticality, "N": num_shards,
                    "proof_key": uploaded_key_proof, "proof_size": uploaded_size_proof
                }
            
            else: # Phương pháp Tuyến tính
                with st.container(border=True):
                    st.warning("Lưu ý: Phương pháp này chỉ nhân bản cấu hình cũ, không tối ưu cho Redis.")
                    c1, c2, c3 = st.columns(3)
                    curr_ram = c1.number_input("RAM Hiện tại (GB)", value=16)
                    curr_cpu = c2.number_input("vCPU Hiện tại", value=4)
                    curr_disk = c3.number_input("Disk Hiện tại (GB)", value=50)
                    
                    l1, l2 = st.columns(2)
                    load_ram = l1.slider("% RAM đang dùng", 0, 100, 70)
                    load_cpu = l2.slider("% CPU đang dùng", 0, 100, 30)
                    target_scale = st.number_input("Tỉ lệ mở rộng (Scale Ratio)", value=1.5)

                    redis_params = {
                        "method": "linear", "curr_ram": curr_ram, "curr_cpu": curr_cpu, 
                        "curr_disk": curr_disk, "load_ram": load_ram, "load_cpu": load_cpu,
                        "scale": target_scale
                    }

    # Cột hiển thị kết quả
    with col_result:
        st.subheader("Kết quả Định cỡ")
        
        # Nút Tính toán
        if st.button("TÍNH TOÁN TÀI NGUYÊN REDIS", type="primary", use_container_width=True):
            
            final_model = ""
            node_config = {}
            total_size_gb = 0

            # Logic Tính toán Redis
            if redis_params["method"] == "keys":
                # Tính dung lượng Data (GB)
                total_size_gb = (redis_params["A"] * redis_params["B_KB"]) / (1024 * 1024)
                
                # Logic chọn mô hình
                if total_size_gb < 32:
                    final_model = "Redis Sentinel"
                    req_ram = (total_size_gb * 1.1) / 0.8
                    node_config = {"qty": 3, "vCPU": 16, "RAM": math.ceil(req_ram), "Disk": math.ceil(req_ram * 4)}
                    st.info(f"Tổng dung lượng Data: {total_size_gb:.2f} GB (<32GB) -> Đề xuất mô hình Sentinel")
                else:
                    final_model = "Redis Cluster"
                    N = redis_params["N"]
                    slaves = 2 if "Đặc biệt" in redis_params["criticality"] else 1
                    total_nodes = N * (1 + slaves)
                    req_ram = (total_size_gb * 1.1) / 0.8 / N
                    node_config = {"qty": total_nodes, "vCPU": 8, "RAM": math.ceil(req_ram), "Disk": math.ceil(req_ram * 4)}
                    st.info(f"Tổng dung lượng Data: {total_size_gb:.2f} GB (>32GB) -> Đề xuất mô hình Cluster ({N} Shards)")
            
            else: # Tuyến tính
                p = redis_params
                req_ram_total = (p["curr_ram"] * (p["load_ram"]/100) * p["scale"] * growth_factor) / 0.9
                req_cpu_total = (p["curr_cpu"] * (p["load_cpu"]/100) * p["scale"] * growth_factor) / 0.75
                final_model = "Redis Sentinel (Tuyến tính)"
                node_config = {"qty": 3, "vCPU": max(4, math.ceil(req_cpu_total/3)), "RAM": math.ceil(req_ram_total/3), "Disk": math.ceil(req_ram_total/3)*4}

            # Hiển thị Kết quả (Card Style)
            with st.container(border=True):
                st.markdown(f"**Kiến trúc đề xuất:** {final_model}")
                st.markdown(f"**Tổng số Node:** {node_config['qty']}")
                
                st.divider()
                st.markdown("#### Cấu hình mỗi Node")
                
                m1, m2 = st.columns(2)
                m1.metric("vCPU", f"{node_config['vCPU']} Core")
                m2.metric("RAM", f"{node_config['RAM']} GB", delta="Đã bao gồm Buffer")
                
                m3, m4 = st.columns(2)
                m3.metric("Lưu trữ (Disk)", f"{node_config['Disk']} GB", "Tỉ lệ 4x RAM")
                m4.metric("Mạng (Network)", "10 Gbps")

            # Khu vực Xuất báo cáo & Lưu
            st.divider()
            c_down, c_save = st.columns(2)
            
            with c_down:
                # Tạo file Word
                doc = Document()
                doc.add_heading('BAO CAO DINH CO REDIS', 0)
                doc.add_paragraph(f"Mo hinh: {final_model}")
                doc.add_paragraph(f"Cau hinh Node: {node_config['vCPU']} vCPU, {node_config['RAM']} GB RAM")
                b = BytesIO()
                doc.save(b)
                b.seek(0)
                st.download_button("Tai bao cao (.docx)", data=b, file_name="redis_sizing.docx", use_container_width=True)

            with c_save:
                if st.button("Luu vao Co so du lieu", use_container_width=True):
                    if system_info_id:
                        db_payload = {
                            "moTa": redis_desc, "mucDich": redis_purpose,
                            "keyNumber": redis_params.get("A", 0), "avgSize": redis_params.get("B_KB", 0),
                            "deXuat": final_model, "ram": node_config['RAM'], "vCpu": node_config['vCPU'], "disk": node_config['Disk']
                        }
                        success, res = save_redis_sizing(system_info_id, db_payload)
                        if success: st.success("Lưu dữ liệu thành công!")
                        else: st.error(f"Lỗi: {res}")
                    else:
                        st.error("Chưa nhập Mã hệ thống (System ID)")