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

# --- CSS TÙY CHỈNH ---
st.markdown("""
<style>
    /* Font chữ toàn hệ thống */
    html, body, [class*="css"] {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    /* Màu nền chính */
    .main { background-color: #f4f6f9; }
    
    /* Header Bar */
    .header-style {
        background-color: #2c3e50;
        padding: 20px;
        border-radius: 8px;
        color: white;
        margin-bottom: 25px;
        border-left: 5px solid #e74c3c;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header-title {
        font-size: 24px;
        font-weight: 600;
        margin: 0;
        text-transform: uppercase;
    }
    .header-subtitle {
        font-size: 14px;
        opacity: 0.8;
        margin-top: 5px;
    }

    /* Card/Container Styling */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        background-color: white;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        border: 1px solid #e0e0e0;
        margin-bottom: 15px;
    }

    /* Metric Box Styling */
    div[data-testid="stMetric"] {
        background-color: #ffffff;
        border: 1px solid #dcdcdc;
        padding: 15px;
        border-radius: 6px;
        border-left: 4px solid #3498db;
    }
    div[data-testid="stMetric"] label {
        font-weight: bold;
        color: #555;
    }

    /* Button Styling */
    .stButton>button {
        background-color: #2980b9;
        color: white;
        font-weight: 600;
        border-radius: 4px;
        border: none;
        height: 45px;
        width: 100%;
        transition: background 0.3s;
    }
    .stButton>button:hover {
        background-color: #1c5980;
    }

    /* Slider Styling (Màu đỏ theo yêu cầu) */
    div.stSlider > div[data-baseweb = "slider"] > div > div > div[role="slider"]{
        background-color: #ff4b4b !important;
        box-shadow: 0 0 5px rgba(255, 75, 75, 0.5);
    }
    div.stSlider > div[data-baseweb = "slider"] > div > div > div > div {
        background-color: #ff4b4b !important;
    }
    
    /* Input field adjustment */
    .stTextInput input, .stNumberInput input {
        background-color: #f8f9fa;
    }
</style>
""", unsafe_allow_html=True)

# --- KHỞI TẠO SESSION STATE (CHO ORACLE/BASELINE) ---
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

# --- TIÊU ĐỀ TRANG ---
st.markdown("""
<div class="header-style">
    <div class="header-title">Công cụ Định cỡ Hạ tầng Cơ sở dữ liệu</div>
    <div class="header-subtitle">Hỗ trợ lập kế hoạch tài nguyên hệ thống (Sizing Tool)</div>
</div>
""", unsafe_allow_html=True)

# --- THANH BÊN (SIDEBAR) ---
with st.sidebar:
    st.header("Cấu hình chung")
    
    # Nhập System ID
    query_params = st.query_params
    url_sys_id = query_params.get("systemInfoId", "")
    
    if url_sys_id:
        system_info_id = url_sys_id
        st.info(f"Mã hệ thống: {system_info_id}")
    else:
        system_info_id = st.text_input("Mã hệ thống (SystemInfo ID)", placeholder="Nhập ID...")

    st.markdown("---")
    
    # Chọn loại DB
    st.subheader("Hệ thống Đích")
    db_type = st.selectbox(
        "Loại Cơ sở dữ liệu",
        ["Oracle RAC", "MariaDB MaxScale", "PostgreSQL", "Redis", "MongoDB"]
    )

    st.markdown("---")
    
    # Tham số an toàn
    with st.expander("Tham số An toàn & Tải", expanded=True):
        growth_factor = st.slider("Hệ số dự phòng", 1.0, 2.0, 1.1, 0.1, help="Dự phòng cho tăng trưởng dữ liệu")
        cpu_threshold = st.slider("Ngưỡng tải CPU tối đa", 0.5, 1.0, 0.75, 0.05)
        ram_threshold = st.slider("Ngưỡng tải RAM tối đa", 0.5, 1.0, 0.90, 0.05)
        disk_threshold = st.slider("Ngưỡng đầy Disk tối đa", 0.5, 1.0, 0.80, 0.05)

# ==========================================
# LOGIC XỬ LÝ CHÍNH
# ==========================================

# --- TRƯỜNG HỢP 1: REDIS SIZING ---
if db_type == "Redis":
    
    col_input, col_result = st.columns([1.2, 0.8], gap="medium")
    
    with col_input:
        st.subheader("Tham số Đầu vào")
        
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

    with col_result:
        st.subheader("Kết quả Định cỡ")
        
        if st.button("TÍNH TOÁN TÀI NGUYÊN REDIS", type="primary", use_container_width=True):
            
            final_model = ""
            node_config = {}
            total_size_gb = 0

            if redis_params["method"] == "keys":
                total_size_gb = (redis_params["A"] * redis_params["B_KB"]) / (1024 * 1024)
                
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
            
            else: 
                p = redis_params
                req_ram_total = (p["curr_ram"] * (p["load_ram"]/100) * p["scale"] * growth_factor) / 0.9
                req_cpu_total = (p["curr_cpu"] * (p["load_cpu"]/100) * p["scale"] * growth_factor) / 0.75
                final_model = "Redis Sentinel (Tuyến tính)"
                node_config = {"qty": 3, "vCPU": max(4, math.ceil(req_cpu_total/3)), "RAM": math.ceil(req_ram_total/3), "Disk": math.ceil(req_ram_total/3)*4}

            with st.container(border=True):
                st.markdown(f"**Kiến trúc đề xuất:** `{final_model}`")
                st.markdown(f"**Tổng số Node:** {node_config['qty']}")
                
                st.divider()
                st.markdown("#### Cấu hình mỗi Node")
                
                m1, m2 = st.columns(2)
                m1.metric("vCPU", f"{node_config['vCPU']} Core")
                m2.metric("RAM", f"{node_config['RAM']} GB", delta="Đã bao gồm Buffer")
                
                m3, m4 = st.columns(2)
                m3.metric("Lưu trữ (Disk)", f"{node_config['Disk']} GB", "Tỉ lệ 4x RAM")
                m4.metric("Mạng (Network)", "10 Gbps")

            st.divider()
            c_down, c_save = st.columns(2)
            
            with c_down:
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

# --- TRƯỜNG HỢP 2: MONGODB SIZING ---
elif db_type == "MongoDB":
    
    col_input, col_result = st.columns([1.2, 0.8], gap="medium")
    
    with col_input:
        st.subheader("Tham số Đầu vào (MongoDB)")
        
        tab_info, tab_sizing = st.tabs(["Thông tin Mô hình", "Số liệu Tính toán"])
        
        with tab_info:
            with st.container(border=True):
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("**1. Sơ đồ Logic (Diagram)**")
                    uploaded_logic_img = st.file_uploader("Tải lên sơ đồ", type=['png', 'jpg'], key="mongo_logic")
                    if uploaded_logic_img:
                        st.image(uploaded_logic_img, use_container_width=True)
                with c2:
                    st.markdown("**2. Ảnh Minh họa (Tùy chọn)**")
                    uploaded_ref_img = st.file_uploader("Tải lên ảnh tham khảo", type=['png', 'jpg'], key="mongo_ref")
                    if uploaded_ref_img:
                        st.image(uploaded_ref_img, use_container_width=True)

            with st.container(border=True):
                st.markdown("**3. Thông tin Nghiệp vụ**")
                mongo_desc = st.text_area("Mô tả module", height=100, placeholder="Chức năng chính, loại dữ liệu lưu trữ...", key="mongo_desc")
                mongo_purpose = st.text_area("Mục đích sử dụng", height=100, placeholder="Ví dụ: Lưu trữ Log, Catalog sản phẩm...", key="mongo_purp")

        with tab_sizing:
            method = st.radio("Phương pháp tính toán", ["Theo số lượng Document (Khuyên dùng)", "Tuyến tính theo cấu hình cũ"], horizontal=True, key="mongo_method")
            
            mongo_params = {}

            if "Document" in method:
                with st.container(border=True):
                    st.markdown("#### Chỉ số Document (Bản ghi)")
                    c_doc1, c_doc2 = st.columns(2)
                    
                    with c_doc1:
                        doc_count = st.number_input("Tổng số lượng Document", min_value=1, value=5000000, step=100000, format="%d", help="Tổng số bản ghi dự kiến lưu trữ")
                        st.caption("Nguồn: Lệnh `db.collection.count()`")
                        uploaded_doc_proof = st.file_uploader("Ảnh sở cứ (Số lượng)", type=['png', 'jpg'], key="kp_mongo")
                    
                    with c_doc2:
                        avg_doc_size_kb = st.number_input("Kích thước TB/Doc (KB)", min_value=0.0, value=4.0, step=0.1)
                        st.caption("Nguồn: Lệnh `db.collection.stats()`")
                        uploaded_size_proof = st.file_uploader("Ảnh sở cứ (Kích thước)", type=['png', 'jpg'], key="sp_mongo")

                with st.container(border=True):
                    st.markdown("#### Tỷ lệ Dữ liệu & Index")
                    c_ws1, c_ws2 = st.columns(2)
                    with c_ws1:
                        working_set_pct = st.slider("Tỷ lệ Dữ liệu nóng (Working Set)", 10, 100, 20, 5)
                    with c_ws2:
                        index_overhead = st.slider("Overhead cho Index & Oplog", 10, 50, 15, 5)

                mongo_params = {
                    "method": "docs", "doc_count": doc_count, "doc_size_kb": avg_doc_size_kb,
                    "working_set": working_set_pct, "overhead": index_overhead,
                    "proof_key": uploaded_doc_proof, "proof_size": uploaded_size_proof
                }
            
            else: 
                with st.container(border=True):
                    st.warning("Lưu ý: Phương pháp này chỉ nhân bản cấu hình cũ.")
                    c1, c2, c3 = st.columns(3)
                    curr_ram = c1.number_input("RAM Hiện tại (GB)", value=32, key="m_ram")
                    curr_cpu = c2.number_input("vCPU Hiện tại", value=8, key="m_cpu")
                    curr_disk = c3.number_input("Disk Hiện tại (GB)", value=500, key="m_disk")
                    
                    l1, l2 = st.columns(2)
                    load_ram = l1.slider("% RAM đang dùng", 0, 100, 70, key="m_load_ram")
                    load_cpu = l2.slider("% CPU đang dùng", 0, 100, 30, key="m_load_cpu")
                    target_scale = st.number_input("Tỉ lệ mở rộng (Scale Ratio)", value=1.5, key="m_scale")

                    mongo_params = {
                        "method": "linear", "curr_ram": curr_ram, "curr_cpu": curr_cpu, "curr_disk": curr_disk, 
                        "load_ram": load_ram, "load_cpu": load_cpu, "scale": target_scale
                    }

    with col_result:
        st.subheader("Kết quả Định cỡ MongoDB")
        
        if st.button("TÍNH TOÁN TÀI NGUYÊN MONGODB", type="primary", use_container_width=True):
            
            final_model = ""
            node_config = {}
            total_storage_gb = 0
            
            if mongo_params["method"] == "docs":
                raw_data_gb = (mongo_params["doc_count"] * mongo_params["doc_size_kb"]) / (1024 * 1024)
                total_storage_gb = raw_data_gb * (1 + mongo_params["overhead"]/100) * growth_factor
                
                raw_ram_gb = total_storage_gb * (mongo_params["working_set"] / 100)
                req_ram = raw_ram_gb / ram_threshold
                
                req_cpu = req_ram / 4 
                if req_cpu < 4: req_cpu = 4 

                SHARDING_THRESHOLD = 1024 
                
                if total_storage_gb < SHARDING_THRESHOLD:
                    final_model = "Replica Set (3 Nodes)"
                    node_config = {"qty": 3, "vCPU": math.ceil(req_cpu), "RAM": math.ceil(req_ram), "Disk": math.ceil(total_storage_gb / disk_threshold)}
                    st.info(f"Dung lượng Data dự kiến: {total_storage_gb:.2f} GB (<1TB) -> Đề xuất mô hình **Replica Set** tiêu chuẩn.")
                else:
                    final_model = "Sharded Cluster"
                    num_shards = math.ceil(total_storage_gb / SHARDING_THRESHOLD)
                    if num_shards < 2: num_shards = 2
                    
                    total_data_nodes = num_shards * 3
                    
                    per_shard_storage = total_storage_gb / num_shards
                    per_shard_ram = req_ram / num_shards
                    per_shard_cpu = req_cpu / num_shards
                    
                    node_config = {"qty": total_data_nodes, "vCPU": max(4, math.ceil(per_shard_cpu)), "RAM": max(16, math.ceil(per_shard_ram)), "Disk": math.ceil(per_shard_storage / disk_threshold)}
                    st.info(f"Dung lượng Data dự kiến: {total_storage_gb:.2f} GB (>1TB) -> Đề xuất mô hình **Sharded Cluster** ({num_shards} Shards).")
                    st.warning(f"Lưu ý: Cần thêm 3 Node Config Server và ít nhất 2 Node Mongos (Router).")

            else: 
                p = mongo_params
                req_ram_total = (p["curr_ram"] * (p["load_ram"]/100) * p["scale"] * growth_factor) / ram_threshold
                req_cpu_total = (p["curr_cpu"] * (p["load_cpu"]/100) * p["scale"] * growth_factor) / cpu_threshold
                req_disk_total = (p["curr_disk"] * p["scale"] * growth_factor) / disk_threshold
                
                final_model = "Replica Set (Tuyến tính)"
                node_config = {"qty": 3, "vCPU": max(4, math.ceil(req_cpu_total)), "RAM": math.ceil(req_ram_total), "Disk": math.ceil(req_disk_total)}

            with st.container(border=True):
                st.markdown(f"**Kiến trúc:** `{final_model}`")
                st.markdown(f"**Tổng Data Node:** `{node_config['qty']}`")
                
                st.divider()
                st.markdown("#### Cấu hình mỗi Node (Data Node)")
                
                m1, m2 = st.columns(2)
                m1.metric("vCPU", f"{node_config['vCPU']} Core")
                m2.metric("RAM", f"{node_config['RAM']} GB")
                
                m3, m4 = st.columns(2)
                m3.metric("Lưu trữ (Disk)", f"{node_config['Disk']} GB")
                m4.metric("IOPS Dự kiến", "3000+")

            st.divider()
            c_down, c_save = st.columns(2)
            
            with c_down:
                doc = Document()
                doc.add_heading('BÁO CÁO ĐỊNH CỠ MONGODB', 0)
                doc.add_paragraph(f"Mô hình: {final_model}")
                doc.add_paragraph(f"Số lượng Node: {node_config['qty']}")
                doc.add_paragraph(f"Cấu hình mỗi Node: {node_config['vCPU']} vCPU, {node_config['RAM']} GB RAM, {node_config['Disk']} GB Disk")
                
                b = BytesIO()
                doc.save(b)
                b.seek(0)
                st.download_button("Tải báo cáo (.docx)", data=b, file_name="mongodb_sizing.docx", use_container_width=True)

            with c_save:
                if st.button("Lưu vào CSDL", use_container_width=True, key="save_mongo"):
                    if system_info_id:
                        st.warning("Đang sử dụng cấu trúc lưu tạm thời.")
                        db_payload = {
                            "moTa": mongo_desc, "mucDich": mongo_purpose,
                            "keyNumber": mongo_params.get("doc_count", 0), 
                            "avgSize": mongo_params.get("doc_size_kb", 0),
                            "deXuat": final_model, 
                            "ram": node_config['RAM'], "vCpu": node_config['vCPU'], "disk": node_config['Disk']
                        }
                        success, res = save_redis_sizing(system_info_id, db_payload) 
                        if success: st.success("Lưu dữ liệu thành công!")
                        else: st.error(f"Lỗi: {res}")
                    else:
                        st.error("Chưa nhập Mã hệ thống (System ID)")

# --- TRƯỜNG HỢP 3: POSTGRESQL SIZING ---
elif db_type == "PostgreSQL":
    
    col_input, col_result = st.columns([1.2, 0.8], gap="medium")
    
    with col_input:
        st.subheader("Tham số Đầu vào (PostgreSQL)")
        
        # Tabs nhập liệu
        tab_info, tab_sizing = st.tabs(["Thông tin Mô hình", "Số liệu Tính toán"])
        
        with tab_info:
            with st.container(border=True):
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("**1. Sơ đồ Logic (Diagram)**")
                    uploaded_logic_img = st.file_uploader("Tải lên sơ đồ HA", type=['png', 'jpg'], key="pg_logic")
                    if uploaded_logic_img:
                        st.image(uploaded_logic_img, use_container_width=True)
                with c2:
                    st.markdown("**2. Ảnh Minh họa (Patroni/Cluster)**")
                    uploaded_ref_img = st.file_uploader("Tải lên ảnh tham khảo", type=['png', 'jpg'], key="pg_ref")
                    if uploaded_ref_img:
                        st.image(uploaded_ref_img, use_container_width=True)

            with st.container(border=True):
                st.markdown("**3. Thông tin Nghiệp vụ**")
                pg_desc = st.text_area("Mô tả module", height=100, placeholder="Ví dụ: Core Banking, Payment Gateway...", key="pg_desc")
                pg_purpose = st.text_area("Mục đích sử dụng", height=100, placeholder="Ví dụ: OLTP Transaction, Data Warehousing...", key="pg_purp")

        with tab_sizing:
            method = st.radio("Phương pháp tính toán", ["Theo Dung lượng & TPS (Khuyên dùng)", "Tuyến tính theo cấu hình cũ"], horizontal=True, key="pg_method")
            
            pg_params = {}

            if "Dung lượng" in method:
                with st.container(border=True):
                    st.markdown("#### Dự báo Dữ liệu (Storage)")
                    c_st1, c_st2 = st.columns(2)
                    
                    with c_st1:
                        raw_data_gb = st.number_input("Dung lượng Dữ liệu thô (GB)", min_value=10, value=500, step=50, help="Dung lượng thực tế chưa bao gồm Index")
                        st.caption("Dữ liệu dự kiến trong 1-2 năm tới")
                    
                    with c_st2:
                        index_ratio = st.slider("Tỷ lệ Index & Bloat (%)", 20, 100, 50, help="Postgres B-Tree Index khá nặng + cơ chế MVCC gây bloat")
                        st.caption("Khuyến nghị: 40-50% cho hệ thống OLTP")

                with st.container(border=True):
                    st.markdown("#### Hiệu năng (Compute)")
                    c_perf1, c_perf2 = st.columns(2)
                    
                    with c_perf1:
                        tps_target = st.number_input("TPS Mục tiêu (Transaction/s)", value=1000, step=100, help="Số lượng giao dịch ghi/đọc mỗi giây")
                    
                    with c_perf2:
                        # Postgres dựa nhiều vào OS Cache
                        working_set = st.slider("Tỷ lệ Working Set (%)", 10, 80, 25, help="% Dữ liệu thường xuyên truy cập cần nằm trên RAM")

                # Cấu hình HA
                with st.container(border=True):
                    st.markdown("#### Mô hình High Availability (HA)")
                    ha_mode = st.selectbox("Kiến trúc HA", [
                        "Patroni Cluster (3 Nodes - Khuyên dùng)", 
                        "Primary - Standby (2 Nodes)",
                        "Standalone (1 Node - Dev/Test)"
                    ])

                pg_params = {
                    "method": "calc", 
                    "raw_data": raw_data_gb, 
                    "index_ratio": index_ratio,
                    "tps": tps_target,
                    "working_set": working_set,
                    "ha_mode": ha_mode
                }
            
            else: # Tuyến tính
                with st.container(border=True):
                    st.warning("Lưu ý: Phương pháp này chỉ nhân bản cấu hình cũ.")
                    c1, c2, c3 = st.columns(3)
                    curr_ram = c1.number_input("RAM Hiện tại (GB)", value=32, key="pg_ram")
                    curr_cpu = c2.number_input("vCPU Hiện tại", value=8, key="pg_cpu")
                    curr_disk = c3.number_input("Disk Hiện tại (GB)", value=500, key="pg_disk")
                    
                    l1, l2 = st.columns(2)
                    load_ram = l1.slider("% RAM đang dùng", 0, 100, 70, key="pg_load_ram")
                    load_cpu = l2.slider("% CPU đang dùng", 0, 100, 30, key="pg_load_cpu")
                    target_scale = st.number_input("Tỉ lệ mở rộng (Scale Ratio)", value=1.5, key="pg_scale")

                    pg_params = {
                        "method": "linear", 
                        "curr_ram": curr_ram, "curr_cpu": curr_cpu, "curr_disk": curr_disk, 
                        "load_ram": load_ram, "load_cpu": load_cpu, 
                        "scale": target_scale
                    }

    # Cột hiển thị kết quả
    with col_result:
        st.subheader("Kết quả Định cỡ PostgreSQL")
        
        if st.button("TÍNH TOÁN TÀI NGUYÊN POSTGRES", type="primary", use_container_width=True):
            
            final_model = ""
            node_config = {}
            note_storage = ""
            
            # --- LOGIC TÍNH TOÁN POSTGRES ---
            if pg_params["method"] == "calc":
                # 1. Tính Storage (Mỗi node phải chứa Full Data)
                # Total Disk = Raw * (1 + Index%) * Growth
                disk_need = pg_params["raw_data"] * (1 + pg_params["index_ratio"]/100) * growth_factor
                disk_final = math.ceil(disk_need / disk_threshold)
                
                # 2. Tính RAM
                # RAM Need = (Total Disk Used * Working Set) / Ram Threshold
                # Working Set ở đây tính trên Data thực (Raw + Index)
                data_on_disk = pg_params["raw_data"] * (1 + pg_params["index_ratio"]/100)
                ram_need = (data_on_disk * (pg_params["working_set"]/100)) / ram_threshold
                # Ràng buộc tối thiểu cho OS và Shared Buffers
                if ram_need < 8: ram_need = 8
                
                # 3. Tính CPU (Dựa trên TPS và RAM)
                # Rule of thumb: 1 vCPU gánh được khoảng 200-500 TPS tùy complexity. Lấy trung bình 300.
                cpu_by_tps = pg_params["tps"] / 300 
                # Rule of thumb: 1 vCPU cho 4GB RAM (để quản lý buffer, connections)
                cpu_by_ram = ram_need / 4
                
                cpu_final = max(cpu_by_tps, cpu_by_ram)
                if cpu_final < 4: cpu_final = 4

                # 4. Mô hình
                final_model = pg_params["ha_mode"]
                if "3 Nodes" in final_model:
                    qty = 3
                    note_storage = "Dữ liệu được NHÂN BẢN (Duplicate) trên cả 3 Node."
                elif "2 Nodes" in final_model:
                    qty = 2
                    note_storage = "Dữ liệu được NHÂN BẢN (Duplicate) trên cả 2 Node."
                else:
                    qty = 1
                    note_storage = "Chạy đơn lẻ (Không có HA)."

                node_config = {
                    "qty": qty, 
                    "vCPU": math.ceil(cpu_final), 
                    "RAM": math.ceil(ram_need), 
                    "Disk": disk_final
                }
                
                st.info(f"Dung lượng lưu trữ yêu cầu (bao gồm Index & Bloat): **{disk_need:.2f} GB**")

            else: # Tuyến tính
                p = pg_params
                req_ram_total = (p["curr_ram"] * (p["load_ram"]/100) * p["scale"] * growth_factor) / ram_threshold
                req_cpu_total = (p["curr_cpu"] * (p["load_cpu"]/100) * p["scale"] * growth_factor) / cpu_threshold
                req_disk_total = (p["curr_disk"] * p["scale"] * growth_factor) / disk_threshold
                
                final_model = "Patroni HA (Tuyến tính)"
                node_config = {
                    "qty": 3, # Mặc định HA 3 node
                    "vCPU": max(4, math.ceil(req_cpu_total)), 
                    "RAM": math.ceil(req_ram_total), 
                    "Disk": math.ceil(req_disk_total)
                }
                note_storage = "Tính theo cấu hình hiện tại nhân bản."

            # Hiển thị Kết quả (Card Style)
            with st.container(border=True):
                st.markdown(f"**Kiến trúc:** `{final_model}`")
                st.markdown(f"**Số lượng Server:** `{node_config['qty']}`")
                
                st.divider()
                st.markdown("#### Cấu hình mỗi Node")
                
                m1, m2 = st.columns(2)
                m1.metric("vCPU", f"{node_config['vCPU']} Core", delta_color="off")
                m2.metric("RAM", f"{node_config['RAM']} GB", help="Shared Buffers + OS Cache")
                
                m3, m4 = st.columns(2)
                m3.metric("Lưu trữ (Disk)", f"{node_config['Disk']} GB", "Local SSD")
                m4.metric("Dữ liệu", "Duplicate", help="Mỗi Node chứa 100% dữ liệu")

            st.caption(f"ℹ️ *Ghi chú Storage: {note_storage}*")

            # Khu vực Xuất báo cáo & Lưu
            st.divider()
            c_down, c_save = st.columns(2)
            
            with c_down:
                doc = Document()
                doc.add_heading('BÁO CÁO ĐỊNH CỠ POSTGRESQL', 0)
                doc.add_paragraph(f"Mô hình: {final_model}")
                doc.add_paragraph(f"Số lượng Node: {node_config['qty']}")
                doc.add_paragraph(f"Cấu hình mỗi Node: {node_config['vCPU']} vCPU, {node_config['RAM']} GB RAM, {node_config['Disk']} GB Disk")
                doc.add_paragraph(f"Lưu ý: {note_storage}")
                
                b = BytesIO()
                doc.save(b)
                b.seek(0)
                st.download_button("Tải báo cáo (.docx)", data=b, file_name="postgres_sizing.docx", use_container_width=True)

            with c_save:
                if st.button("Lưu vào CSDL", use_container_width=True, key="save_pg"):
                    if system_info_id:
                        # Demo dùng API Redis tạm thời
                        db_payload = {
                            "moTa": pg_desc, "mucDich": pg_purpose,
                            "keyNumber": 0, "avgSize": 0, # Postgres ko dùng key
                            "deXuat": final_model, 
                            "ram": node_config['RAM'], "vCpu": node_config['vCPU'], "disk": node_config['Disk']
                        }
                        success, res = save_redis_sizing(system_info_id, db_payload) 
                        if success: st.success("Lưu dữ liệu thành công!")
                        else: st.error(f"Lỗi: {res}")
                    else:
                        st.error("Chưa nhập Mã hệ thống (System ID)")

# --- TRƯỜNG HỢP 4: ORACLE/MARIA/DB THƯỜNG ---
else:
    
    col_input, col_result = st.columns([1.2, 0.8], gap="large")
    
    with col_input:
        st.subheader("A. Hệ thống Tham chiếu (Baseline)")
        
        with st.container(border=True):
            c1, c2 = st.columns(2)
            current_ccu = c1.number_input("CCU Hiện tại", value=100)
            target_ccu = c2.number_input("CCU Mục tiêu", value=200)
            scale_ratio = target_ccu / current_ccu
            st.caption(f"Tỉ lệ Scale: **{scale_ratio:.2f}x**")

        st.markdown("#### Danh sách Server hiện tại")
        
        for i, server in enumerate(st.session_state.servers):
            with st.container(border=True):
                head_col1, head_col2 = st.columns([0.85, 0.15])
                head_col1.markdown(f"**Server {i + 1}**")
                if head_col2.button("🗑️", key=f"btn_del_{i}"):
                    remove_server(i)
                    st.rerun()

                row1 = st.columns([2, 1, 1])
                server["ip"] = row1[0].text_input(f"IP Sv{i+1}", value=server["ip"], key=f"ip_{i}")
                server["vcpu"] = row1[1].number_input(f"vCPU Sv{i+1}", value=server["vcpu"], key=f"cpu_{i}")
                server["ram"] = row1[2].number_input(f"RAM(GB) Sv{i+1}", value=server["ram"], key=f"ram_{i}")

                row2 = st.columns(2)
                server["cpu_load"] = row2[0].slider(f"% CPU Used Sv{i+1}", 0, 100, server["cpu_load"], key=f"sld_cpu_{i}")
                server["ram_load"] = row2[1].slider(f"% RAM Used Sv{i+1}", 0, 100, server["ram_load"], key=f"sld_ram_{i}")

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

    with col_result:
        st.subheader("B. Kết quả & Đề xuất")
        
        with st.container(border=True):
            st.markdown("##### Cấu hình Mục tiêu")
            min_node = 2 if db_type == "Oracle RAC" else 1
            proposed_n = st.number_input("Số Node đề xuất:", min_value=min_node, value=max(len(st.session_state.servers), min_node))
            
            calc_btn = st.button("TÍNH TOÁN SIZING", type="primary", use_container_width=True)

        if calc_btn:
            total_cpu_used = 0
            total_ram_used = 0
            
            for s in st.session_state.servers:
                total_cpu_used += s["vcpu"] * (s["cpu_load"] / 100)
                total_ram_used += s["ram"] * (s["ram_load"] / 100)

            req_cpu = (total_cpu_used * scale_ratio * growth_factor) / cpu_threshold
            req_ram = (total_ram_used * scale_ratio * growth_factor) / ram_threshold
            
            req_disk_data = (current_storage_used_data * scale_ratio * growth_factor) / disk_threshold
            req_disk_log = (current_storage_used_log * scale_ratio * growth_factor) / disk_threshold
            
            per_node_cpu = math.ceil(math.ceil(req_cpu) / proposed_n)
            per_node_ram = math.ceil(math.ceil(req_ram) / proposed_n)
            
            is_shared = db_type == "Oracle RAC"
            storage_txt = f"{math.ceil(req_disk_data)} GB (Shared)" if is_shared else f"{math.ceil(req_disk_data)} GB (Mỗi Node)"

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