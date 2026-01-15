import streamlit as st
import pandas as pd
from docx import Document
from docx.shared import Inches
from io import BytesIO
from datetime import datetime
import math
import requests

# --- Cấu hình Backend API ---
BACKEND_API_URL = "http://localhost:8081/api"

# --- Hàm lưu kết quả sizing vào bảng Redis ---
def save_redis_sizing(system_info_id, redis_data):
    """Lưu kết quả tính toán sizing Redis vào database"""
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

# --- Cấu hình trang ---
st.set_page_config(page_title="DB Sizing Tool v6 - Redis Supported", layout="wide")
st.subheader("Database Infrastructure Sizing Tool (v6)")

# --- Lấy SystemInfoId từ URL params ---
query_params = st.query_params
system_info_id = query_params.get("systemInfoId", "")

if system_info_id:
    st.success(f"🔗 Đang làm việc với SystemInfo ID: **{system_info_id}**")
else:
    st.warning("⚠️ Chưa có SystemInfo ID. Vui lòng lưu 'Yêu cầu bài toán' từ trang chính trước.")
    system_info_id = st.text_input("Hoặc nhập SystemInfo ID thủ công:", "")

# --- 1. Cấu hình Hệ thống & Tham số ---
st.sidebar.header("1. Cấu hình chung")
db_type = st.sidebar.selectbox(
    "Loại Database:",
    ["Redis", "Oracle RAC", "MariaDB MaxScale", "MariaDB Galera", "PostgreSQL", "MongoDB"]
)

with st.sidebar.expander("Tham số An toàn (Safety Factors)"):
    growth_factor = st.number_input("Growth Factor (Mặc định 1.1)", value=1.1, step=0.1)
    cpu_threshold = st.number_input("Max CPU Load (0.75)", value=0.75, step=0.05)
    ram_threshold = st.number_input("Max RAM Load (0.9)", value=0.90, step=0.05)
    disk_threshold = st.number_input("Max Disk Fill (0.8)", value=0.80, step=0.05)

st.markdown("---")

# ==========================================
# KHU VỰC XỬ LÝ RIÊNG CHO REDIS
# ==========================================
if db_type == "Redis":
    st.subheader(f"2. Định cỡ cho: {db_type}")
    
    col_redis_input, col_redis_result = st.columns([1, 1])
    
    with col_redis_input:
        st.info("Nhập thông tin đặc tả Redis")
        
        # 1. Upload Mô hình Logic
        st.markdown("**1. Mô hình Logic & Minh họa**")
        uploaded_logic_img = st.file_uploader("Upload ảnh Mô hình Logic (Kết nối, Port...)", type=['png', 'jpg', 'jpeg'])
        if uploaded_logic_img:
            st.image(uploaded_logic_img, caption="Mô hình Logic", use_container_width=True)
            
        uploaded_ref_img = st.file_uploader("Upload ảnh Minh họa (Tùy chọn)", type=['png', 'jpg', 'jpeg'])
        if uploaded_ref_img:
            with st.expander("Xem ảnh minh họa"):
                st.image(uploaded_ref_img, caption="Ảnh minh họa", use_container_width=True)
        
        # 2. Mô tả & Mục đích
        st.markdown("**2. Thông tin mô tả**")
        redis_desc = st.text_area("Mô tả module Redis (Chức năng, nhiệm vụ)", placeholder="Ví dụ: Module lưu trữ session người dùng...")
        redis_purpose = st.text_area("Mục đích sử dụng", placeholder="Ví dụ: Cache ứng dụng, Message Broker Pub/Sub...")
        
        # 3. Chọn phương pháp tính
        st.markdown("**3. Phương pháp tính toán**")
        calc_method = st.radio("Chọn cách tính:", ["Theo lượng Key dự kiến (Khuyên dùng)", "Tuyến tính theo cấu hình cũ (Không khuyến nghị)"])
        
        redis_params = {} # Dict để lưu tham số cho tính toán sau này
        
        if calc_method == "Theo lượng Key dự kiến (Khuyên dùng)":
            st.markdown("---")
            st.markdown("#### Nhập liệu Key & Size")
            
            # Input A: Lượng Key
            key_count = st.number_input("Tổng lượng Key dự kiến (A)", min_value=1, value=1000000, format="%d")
            st.caption("HDSD: Dùng `dbsize` hoặc `info keyspace` trên môi trường Test/UAT.")
            uploaded_key_proof = st.file_uploader("Upload ảnh sở cứ (Key Count)", type=['png', 'jpg'], key="k_proof")
            
            # Input B: Size trung bình
            avg_size_kb = st.number_input("Kích thước trung bình 1 bản ghi (KB) (B)", min_value=0.0, value=2.0, step=0.1, format="%.2f")
            st.caption("HDSD: Dùng `memory usage <key>` cho 10-20 key mẫu -> lấy trung bình.")
            uploaded_size_proof = st.file_uploader("Upload ảnh sở cứ (Avg Size)", type=['png', 'jpg'], key="s_proof")
            
            # Input bổ sung cho Cluster
            st.markdown("#### Cấu hình Cluster (Nếu cần)")
            system_criticality = st.selectbox("Mức độ quan trọng của hệ thống", ["Hệ thống thường (1 Master - 1 Slave)", "Hệ thống ĐBQT (1 Master - 2 Slave)"])
            num_shards = st.number_input("Số lượng Shard/Master dự kiến (N - Phải là số lẻ)", min_value=1, value=3, step=2)
            if num_shards % 2 == 0:
                st.warning("⚠️ Số lượng Master (N) nên là số lẻ để đảm bảo Quorum tốt nhất.")
            
            redis_params = {
                "method": "keys",
                "A": key_count,
                "B_KB": avg_size_kb,
                "criticality": system_criticality,
                "N": num_shards,
                "proof_key": uploaded_key_proof,
                "proof_size": uploaded_size_proof
            }
            
        else: # Tuyến tính
            st.markdown("---")
            st.markdown("#### Nhập liệu Cấu hình hiện tại (Baseline)")
            st.warning("⚠️ Cách tính này chỉ nhân bản cấu hình cũ, có thể không tối ưu cho Redis.")
            
            # Input tương tự phần Server list cũ
            c1, c2, c3 = st.columns(3)
            curr_ram = c1.number_input("RAM hiện tại (GB)", value=16)
            curr_cpu = c2.number_input("vCPU hiện tại", value=4)
            curr_disk = c3.number_input("Disk hiện tại (GB)", value=50)
            
            l1, l2, l3 = st.columns(3)
            load_ram = l1.slider("% RAM Used", 0, 100, 70)
            load_cpu = l2.slider("% CPU Used", 0, 100, 30)
            load_disk = l3.slider("% Disk Used", 0, 100, 50)
            
            target_scale = st.number_input("Tỉ lệ Scale mong muốn (Ví dụ 2.0 = Gấp đôi tải)", value=1.5)
            
            redis_params = {
                "method": "linear",
                "curr_ram": curr_ram, "curr_cpu": curr_cpu, "curr_disk": curr_disk,
                "load_ram": load_ram, "load_cpu": load_cpu, "load_disk": load_disk,
                "scale": target_scale
            }

    with col_redis_result:
        st.markdown("### Kết quả Đề xuất (Redis)")
        
        if st.button("TÍNH TOÁN REDIS", type="primary"):
            res_report = {} # Lưu kết quả để in báo cáo
            
            if redis_params["method"] == "keys":
                # Logic A: Tính theo Key
                # C (GB) = A * B(KB) / 1024 / 1024
                total_size_gb = (redis_params["A"] * redis_params["B_KB"]) / (1024 * 1024)
                
                st.write(f"📊 **Tổng dung lượng Key (C):** {total_size_gb:,.2f} GB")
                
                final_model = ""
                node_config = {}
                
                # Logic chọn mô hình
                if total_size_gb < 32:
                    final_model = "Redis Sentinel (1 Master - 2 Slave)"
                    # RAM/svr = C * 1.1 / 0.8
                    req_ram = (total_size_gb * 1.1) / 0.8
                    req_cpu = 16 # Fixed default for Sentinel
                    req_disk = 4 * req_ram
                    
                    node_config = {
                        "role": "Mỗi Node (Master/Slave)",
                        "qty": 3,
                        "vCPU": req_cpu,
                        "RAM": math.ceil(req_ram),
                        "Disk": math.ceil(req_disk)
                    }
                    st.success(f"✅ Đề xuất mô hình: **{final_model}** (Do C < 32GB)")
                    
                else:
                    final_model = "Redis Cluster"
                    N = redis_params["N"]
                    criticality = redis_params["criticality"]
                    
                    # Logic DBQT vs Thường
                    slaves_per_master = 2 if "ĐBQT" in criticality else 1
                    total_nodes = N * (1 + slaves_per_master)
                    
                    # RAM/svr = C * 1.1 / 0.8 / N
                    req_ram = (total_size_gb * 1.1) / 0.8 / N
                    req_cpu = 8 # Fixed default for Cluster
                    req_disk = 4 * req_ram
                    
                    node_config = {
                        "role": f"Mỗi Node (Trong cụm {N} Shard)",
                        "qty": total_nodes,
                        "vCPU": req_cpu,
                        "RAM": math.ceil(req_ram),
                        "Disk": math.ceil(req_disk)
                    }
                    st.success(f"✅ Đề xuất mô hình: **{final_model}** (Do C > 32GB)")
                    st.info(f"Cấu trúc: {N} Master, mỗi Master có {slaves_per_master} Slave. Tổng {total_nodes} Node.")

                # Hiển thị cấu hình
                st.markdown("#### Cấu hình Node chi tiết")
                rc1, rc2, rc3 = st.columns(3)
                rc1.metric("vCPU / Node", f"{node_config['vCPU']} vCore")
                rc2.metric("RAM / Node", f"{node_config['RAM']} GB")
                rc3.metric("DISK / Node", f"{node_config['Disk']} GB")
                
                res_report = {
                    "model": final_model,
                    "config": node_config,
                    "data_size": total_size_gb,
                    "params": redis_params
                }

            else:
                # Logic B: Tuyến tính
                # Tính nhu cầu tổng: (Used * Scale * Growth) / Threshold
                p = redis_params
                req_ram_total = (p["curr_ram"] * (p["load_ram"]/100) * p["scale"] * growth_factor) / ram_threshold
                req_cpu_total = (p["curr_cpu"] * (p["load_cpu"]/100) * p["scale"] * growth_factor) / cpu_threshold
                req_disk_total = (p["curr_disk"] * (p["load_disk"]/100) * p["scale"] * growth_factor) / disk_threshold
                
                # Giả định Sentinel 3 node cho đơn giản hoặc giữ nguyên mô hình cũ
                # Ở đây đề xuất chia đều cho 3 node (Sentinel standard)
                per_node_ram = math.ceil(req_ram_total / 3) 
                per_node_cpu = math.ceil(req_cpu_total / 3)
                per_node_disk = math.ceil(req_disk_total / 3) # Hoặc dùng công thức 4*RAM
                
                # Check lại disk theo RAM nếu disk tính ra nhỏ hơn
                if per_node_disk < 4 * per_node_ram:
                    per_node_disk = 4 * per_node_ram
                
                final_model = "Redis Sentinel (Linear Scaled)"
                node_config = {
                        "role": "Mỗi Node",
                        "qty": 3,
                        "vCPU": max(4, per_node_cpu), # Min 4 vCPU
                        "RAM": per_node_ram,
                        "Disk": per_node_disk
                }
                
                st.success(f"✅ Đề xuất mô hình: **{final_model}**")
                st.markdown("#### Cấu hình Node chi tiết")
                rc1, rc2, rc3 = st.columns(3)
                rc1.metric("vCPU / Node", f"{node_config['vCPU']} vCore")
                rc2.metric("RAM / Node", f"{node_config['RAM']} GB")
                rc3.metric("DISK / Node", f"{node_config['Disk']} GB")
                
                res_report = {
                    "model": final_model,
                    "config": node_config,
                    "data_size": 0,
                    "params": redis_params
                }

            # --- Xuất WORD cho REDIS ---
            doc = Document()
            doc.add_heading('BÁO CÁO SIZING REDIS', 0)
            doc.add_paragraph(f'Loại Module: {db_type}')
            doc.add_paragraph(f'Ngày lập: {datetime.now().strftime("%d/%m/%Y")}')
            
            doc.add_heading('1. Thông tin Mô hình & Nghiệp vụ', level=1)
            doc.add_paragraph(f"Mô tả: {redis_desc}")
            doc.add_paragraph(f"Mục đích sử dụng: {redis_purpose}")
            doc.add_paragraph("Lưu ý: Xem ảnh mô hình logic trong file đính kèm hoặc hệ thống.")
            
            doc.add_heading('2. Cơ sở tính toán', level=1)
            if redis_params["method"] == "keys":
                doc.add_paragraph(f"Phương pháp: Theo lượng Key dự kiến")
                doc.add_paragraph(f"- Tổng lượng Key (A): {redis_params['A']:,}")
                doc.add_paragraph(f"- Size trung bình (B): {redis_params['B_KB']} KB")
                doc.add_paragraph(f"- Tổng dung lượng Data (C = A*B): {res_report['data_size']:.2f} GB")
                if res_report['data_size'] < 32:
                     doc.add_paragraph(f"Nhận xét: C < 32GB -> Đề xuất Sentinel.")
                else:
                     doc.add_paragraph(f"Nhận xét: C > 32GB -> Đề xuất Cluster ({redis_params['N']} Shards).")
            else:
                doc.add_paragraph(f"Phương pháp: Tuyến tính (Scale {redis_params['scale']}x)")
            
            doc.add_heading('3. Cấu hình Đề xuất', level=1)
            doc.add_paragraph(f"Mô hình triển khai: {res_report['model']}")
            
            table = doc.add_table(rows=1, cols=2)
            table.style = 'Table Grid'
            def add_r(l, v):
                r = table.add_row().cells
                r[0].text = l
                r[1].text = str(v)
            
            add_r("Số lượng Node", res_report['config']['qty'])
            add_r("vCPU (per Node)", f"{res_report['config']['vCPU']} Core")
            add_r("RAM (per Node)", f"{res_report['config']['RAM']} GB")
            add_r("DISK (per Node)", f"{res_report['config']['Disk']} GB")
            
            doc.add_paragraph("\nGhi chú cấu hình:")
            doc.add_paragraph("- RAM tính toán đã bao gồm hệ số an toàn (RAM thực tế * 1.1 / 0.8).")
            doc.add_paragraph("- Dung lượng Disk khuyến nghị tối thiểu gấp 4 lần RAM để đảm bảo an toàn cho việc Fork process khi RDB snapshot/AOF rewrite.")

            buffer = BytesIO()
            doc.save(buffer)
            buffer.seek(0)
            
            st.download_button(
                "Tải Báo cáo Redis (.docx)", 
                data=buffer, 
                file_name=f"Sizing_Redis_{datetime.now().strftime('%Y%m%d')}.docx"
            )
            
            # --- Lưu kết quả vào Database ---
            if system_info_id:
                redis_db_data = {
                    "moTa": redis_desc,
                    "mucDich": redis_purpose,
                    "keyNumber": redis_params.get("A", 0) if redis_params["method"] == "keys" else 0,
                    "avgSize": redis_params.get("B_KB", 0) if redis_params["method"] == "keys" else 0,
                    "importance": redis_params.get("criticality", "Thường") if redis_params["method"] == "keys" else "Thường",
                    "masterNumber": redis_params.get("N", 1) if redis_params["method"] == "keys" else 1,
                    "sumC": round(res_report.get("data_size", 0), 2),
                    "deXuat": res_report.get("model", ""),
                    "vCpu": res_report.get("config", {}).get("vCPU", 0),
                    "ram": res_report.get("config", {}).get("RAM", 0),
                    "disk": res_report.get("config", {}).get("Disk", 0)
                }
                
                success, result = save_redis_sizing(system_info_id, redis_db_data)
                if success:
                    st.success("✅ Đã lưu kết quả sizing vào database!")
                else:
                    st.error(f"❌ Lỗi khi lưu kết quả: {result}")
            else:
                st.warning("⚠️ Chưa có SystemInfo ID. Kết quả chưa được lưu vào database.")

# ==========================================
# KHU VỰC CŨ CHO CÁC DB KHÁC (ORACLE/MARIA...)
# ==========================================
else: 
    st.subheader(f"2. Định cỡ cho: {db_type}")
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("A. Hệ thống Tham chiếu (Baseline)")
        
        current_ccu = st.number_input("CCU hiện tại", min_value=1, value=100)
        target_ccu = st.number_input("CCU Mục tiêu", min_value=1, value=200)
        scale_ratio = target_ccu / current_ccu
        st.info(f"Tỉ lệ Scale CCU: **{scale_ratio:.2f}x**")

        num_servers = st.number_input("Số lượng Server tham chiếu", min_value=1, value=3)
        
        server_data = []
        with st.container(height=300):
            for i in range(int(num_servers)):
                st.markdown(f"**Server {i+1}**")
                c1, c2, c3 = st.columns([2, 1.5, 1.5])
                ip = c1.text_input(f"IP Sv{i+1}", f"10.207.252.{i+1}")
                cpu_core = c2.number_input(f"vCPU Sv{i+1}", value=32)
                ram_gb = c3.number_input(f"RAM(GB) Sv{i+1}", value=64)
                
                l1, l2 = st.columns(2)
                cpu_load = l1.slider(f"% CPU Used Sv{i+1}", 0, 100, 30 + (i*2))
                ram_load = l2.slider(f"% RAM Used Sv{i+1}", 0, 100, 80 + (i*1))
                st.divider()
                
                server_data.append({
                    "IP": ip, "vCPU": cpu_core, "RAM_GB": ram_gb,
                    "Load_CPU": cpu_load, "Load_RAM": ram_load
                })
                
        st.divider()
        st.markdown("#### Thông tin Lưu trữ")
        current_storage_used_data = st.number_input("Data Used (GB)", value=500)
        current_storage_used_log = st.number_input("Log Used (GB)", value=500)
        current_storage_used_backup = st.number_input("Backup Full Size (GB)", value=500)
        current_days_backup = st.number_input("Ngày lưu Backup", value=2)
        compressed_ratio_backup = st.number_input("Tỉ lệ nén Backup", value=0.8)

    with col2:
        st.markdown("### Cấu hình Cluster Đề xuất")
        min_node_req = 2 if db_type == "Oracle RAC" else 1
        default_node = max(int(num_servers), min_node_req)
        
        proposed_n = st.number_input(f"Số lượng Node đề xuất:", min_value=min_node_req, value=default_node)

        if st.button("TÍNH TOÁN SIZING", type="primary"):
            # 1. Tính tổng tài nguyên Compute ĐANG DÙNG
            total_cpu_used = sum([s['vCPU'] * (s['Load_CPU']/100) for s in server_data])
            total_ram_used = sum([s['RAM_GB'] * (s['Load_RAM']/100) for s in server_data])

            # 2. Tính Tổng nhu cầu (Total Requirements)
            req_total_cpu = (total_cpu_used * scale_ratio * growth_factor) / cpu_threshold
            req_total_ram = (total_ram_used * scale_ratio * growth_factor) / ram_threshold
            
            # Tính Storage (Chung)
            req_total_disk_data = (current_storage_used_data * scale_ratio * growth_factor) / disk_threshold
            req_total_disk_log = (current_storage_used_log * scale_ratio * growth_factor) / disk_threshold
            req_total_disk_backup = (current_storage_used_backup + (current_storage_used_backup*current_days_backup*compressed_ratio_backup)) * scale_ratio * growth_factor / disk_threshold
            
            final_total_cpu = math.ceil(req_total_cpu)
            final_total_ram = math.ceil(req_total_ram)
            final_total_disk_data = math.ceil(req_total_disk_data)
            final_total_disk_log = math.ceil(req_total_disk_log)
            final_total_disk_backup = math.ceil(req_total_disk_backup)

            # 3. Phân bổ theo từng loại DB (LOGIC MỚI CẬP NHẬT Ở ĐÂY)
            per_node_cpu = math.ceil(final_total_cpu / proposed_n)
            per_node_ram = math.ceil(final_total_ram / proposed_n)
            
            storage_msg = ""
            
            # Logic riêng:
            if db_type == "Oracle RAC":
                per_node_data = final_total_disk_data # Shared, hiển thị tổng
                per_node_log = math.ceil(final_total_disk_log / proposed_n) # Log riêng
                storage_note = "Data (Shared NAS/SAN), Log (Local/ASM)"
                storage_val_display = f"{final_total_disk_data} GB (Total Shared)"
            else:
                # Shared Nothing (MariaDB, PG, Mongo) -> Data phải nhân bản
                per_node_data = final_total_disk_data # Mỗi node cần Full Data
                per_node_log = math.ceil(final_total_disk_log / proposed_n)
                storage_note = "Data (Local Replicated - Mỗi Node chứa Full DB)"
                storage_val_display = f"{final_total_disk_data} GB (Per Node)"

            # --- Hiển thị Kết quả ---
            st.divider()
            st.success("**KẾT QUẢ ĐỀ XUẤT**")
            
            r1, r2 = st.columns(2)
            r3, r4, r5 = st.columns(3)
            
            r1.metric("vCPU / Node", f"{per_node_cpu} Cores")
            r2.metric("RAM / Node", f"{per_node_ram} GB")
            r3.metric(" /data ", storage_val_display, storage_note)
            r4.metric(" /log ", f"{per_node_log} GB", "Per Node")
            r5.metric(" /backup ", f"{final_total_disk_backup} GB", "NAS Shared")

            # --- Xuất Word (Giản lược cho code ngắn) ---
            doc = Document()
            doc.add_heading('BÁO CÁO SIZING DATABASE', 0)
            doc.add_paragraph(f"Loại DB: {db_type}")
            doc.add_paragraph(f"Cấu hình mỗi Node ({proposed_n} nodes):")
            doc.add_paragraph(f"- vCPU: {per_node_cpu}")
            doc.add_paragraph(f"- RAM: {per_node_ram} GB")
            doc.add_paragraph(f"- Storage Data: {storage_val_display}")
            
            buffer = BytesIO()
            doc.save(buffer)
            buffer.seek(0)
            st.download_button("Tải Báo cáo (.docx)", data=buffer, file_name=f"Sizing_{db_type}.docx")
