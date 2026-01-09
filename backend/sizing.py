import streamlit as st
import pandas as pd
from docx import Document
from io import BytesIO
from datetime import datetime
import math

# --- Cấu hình trang ---
st.set_page_config(page_title="DB Sizing Tool v5", layout="wide")
st.subheader("Database Infrastructure Sizing Tool (Final)")

# --- Main: Part 1 - Cấu hình Hệ thống & Tham số ---
st.subheader("1. Cấu hình Hệ thống & Tham số")
db_type = st.selectbox(
    "Loại Database:",
    ["Oracle RAC", "MariaDB MaxScale", "MariaDB Galera", "PostgreSQL", "MongoDB"]
)

with st.expander("Tham số Định cỡ (Factors) - Chỉnh sửa Hệ số An toàn", expanded=True):
    growth_factor = st.number_input("Growth Factor (Mặc định 1.1)", value=1.1, step=0.1)
    cpu_threshold = st.number_input("Max CPU Load (0.75)", value=0.75, step=0.05)
    ram_threshold = st.number_input("Max RAM Load (0.9)", value=0.90, step=0.05)
    disk_threshold = st.number_input("Max Disk Fill (0.8)", value=0.80, step=0.05)

st.markdown("---")

# --- Main Interface ---
st.subheader("2. Định cỡ")

# Split into two areas: left = Baseline inputs (Part 1), right = Calculation & Results (Part 2)
col1, col2 = st.columns(2)

with col1:
    st.subheader("A. Hệ thống Tham chiếu (Baseline)")
    
    # --- Cơ sở định cỡ (Server) ---
    st.markdown("#### Cơ sở định cỡ ")
    current_ccu = st.number_input("CCU hiện tại", min_value=1, value=100)
    target_ccu = st.number_input("CCU Mục tiêu", min_value=1, value=200)
    scale_ratio = target_ccu / current_ccu
    st.info(f"Tỉ lệ Scale CCU: **{scale_ratio:.2f}x**")


    num_servers = st.number_input("Số lượng Server tham chiếu", min_value=1, value=3)
    
    server_data = []
    with st.container(height=300):
        for i in range(int(num_servers)):
            st.markdown(f"**Server {i+1}**")
            # Dòng 1: Cấu hình cứng (Chỉ CPU/RAM)
            c1, c2, c3 = st.columns([2, 1.5, 1.5])
            ip = c1.text_input(f"IP Sv{i+1}", f"10.207.252.{i+1}")
            cpu_core = c2.number_input(f"vCPU Sv{i+1}", value=32)
            ram_gb = c3.number_input(f"RAM(GB) Sv{i+1}", value=64)
            
            # Dòng 2: Tải thực tế (Chỉ CPU/RAM)
            l1, l2 = st.columns(2)
            cpu_load = l1.slider(f"% CPU Used Sv{i+1}", 0, 100, 30 + (i*2))
            ram_load = l2.slider(f"% RAM Used Sv{i+1}", 0, 100, 80 + (i*1))
            st.divider()
            
            server_data.append({
                "IP": ip, "vCPU": cpu_core, "RAM_GB": ram_gb,
                "Load_CPU": cpu_load, "Load_RAM": ram_load
            })
            
    st.divider()

    # --- Input Storage  ---
    st.markdown("#### Thông tin Lưu trữ (Data Storage)")
    current_storage_used_data = st.number_input(
        "Tổng dung lượng DATA thực tế đang dùng (GB):", 
        min_value=1, value=500, 
        help="Nhập tổng dung lượng dữ liệu Datafile hiện tại của cả hệ thống."
    )

    current_storage_used_log = st.number_input(
        "Tổng dung lượng LOG thực tế đang dùng (GB):", 
        min_value=1, value=500, 
        help="Nhập tổng dung lượng dữ liệu Log hiện tại của cả hệ thống."
    )


    st.markdown(" Các tham số lưu trữ backup đề xuất")
    current_storage_used_backup = st.number_input(
        "Tổng dung lượng BACKUP thực tế: ", 
        min_value=1, value=500, 
        help="Nhập dung lượng file Backup full của DB"
    )
    current_days_backup = st.number_input("Số ngày lưu bản Backup", min_value=2, value=2)
    compressed_ratio_backup = st.number_input("Tỉ lệ nén bản Backup", min_value=0.5, value=0.8,max_value=1.0)
    

with col2:
    
    # --- Logic Đề xuất Node ---
    st.markdown("### Cấu hình Cluster Đề xuất")
    min_node_req = 2 if db_type == "Oracle RAC" else 1
    default_node = max(int(num_servers), min_node_req)
    
    proposed_n = st.number_input(
        f"Số lượng Server (Node) cho cụm {db_type} mới:", 
        min_value=min_node_req, 
        value=default_node
    )

    if st.button("TÍNH TOÁN SIZING", type="primary"):
        # 1. Tính tổng tài nguyên Compute ĐANG DÙNG
        total_cpu_used = sum([s['vCPU'] * (s['Load_CPU']/100) for s in server_data])
        total_ram_used = sum([s['RAM_GB'] * (s['Load_RAM']/100) for s in server_data])
        # Storage dùng biến current_storage_used

        # 2. Tính Tổng nhu cầu (Total Requirements)
        req_total_cpu = (total_cpu_used * scale_ratio * growth_factor) / cpu_threshold
        req_total_ram = (total_ram_used * scale_ratio * growth_factor) / ram_threshold
        req_total_disk_data = (current_storage_used_data * scale_ratio * growth_factor) / disk_threshold
        req_total_disk_log = (current_storage_used_log * scale_ratio * growth_factor) / disk_threshold
        req_total_disk_backup = (current_storage_used_backup + (current_storage_used_backup*current_days_backup*compressed_ratio_backup))  * scale_ratio * growth_factor / disk_threshold
        # Làm tròn lên
        final_total_cpu = math.ceil(req_total_cpu)
        final_total_ram = math.ceil(req_total_ram)
        final_total_disk_data = math.ceil(req_total_disk_data)
        final_total_disk_log = math.ceil(req_total_disk_log)
        final_total_disk_backup = math.ceil(req_total_disk_backup)

        # 3. Chia tài nguyên
        per_node_cpu = math.ceil(final_total_cpu / proposed_n)
        per_node_ram = math.ceil(final_total_ram / proposed_n)
        per_node_log = math.ceil(final_total_disk_log / proposed_n)
        

        # --- Hiển thị Kết quả ---
        st.divider()
        st.success("**KẾT QUẢ ĐỀ XUẤT**")
        
        if db_type=="Oracle RAC":
            r1, r2 = st.columns(2)
            r3, r4, r5 = st.columns(3)
            r1.metric("vCPU / Node", f"{per_node_cpu} Cores", f"Total Need: {final_total_cpu}")
            r2.metric("RAM / Node", f"{per_node_ram} GB", f"Total Need: {final_total_ram}")
            r3.metric(" /data ", f"{final_total_disk_data} GB", "NAS")
            r4.metric(" /log ", f"{final_total_disk_data} GB", "Each server")
            r5.metric(" /backup ", f"{final_total_disk_data} GB", "NAS")
            st.info(f"Chi tiết Storage: /backup và /data cấp NAS")
        else:
            r1, r2 = st.columns(2)
            r3, r4, r5 = st.columns(3)
            r1.metric("vCPU / Node", f"{per_node_cpu} Cores", f"Total Need: {final_total_cpu}")
            r2.metric("RAM / Node", f"{per_node_ram} GB", f"Total Need: {final_total_ram}")
            r3.metric(" /data ", f"{final_total_disk_data} GB", "Each server (Replicate Data)")
            r4.metric(" /log ", f"{final_total_disk_data} GB", "Each server")
            r5.metric(" /backup ", f"{final_total_disk_data} GB", "NAS")
            st.info(f"Chi tiết Storage: /backup cấp NAS")

        ############################### WORD
        doc = Document()
        doc.add_heading('BÁO CÁO SIZING HỆ THỐNG', 0)
        doc.add_paragraph(f'Loại Database: {db_type}')
        doc.add_paragraph(f'Ngày lập: {datetime.now().strftime("%d/%m/%Y")}')
        
        # 1. Baseline
        doc.add_heading('1. Thông tin Tham chiếu (Baseline)', level=1)
        doc.add_paragraph(f"CCU Hiện tại: {current_ccu} -> Mục tiêu: {target_ccu} (Scale {scale_ratio:.2f}x)")
        
        table = doc.add_table(rows=1, cols=3)
        table.style = 'Table Grid'
        hdr = table.rows[0].cells
        hdr[0].text = 'Server IP'
        hdr[1].text = 'CPU (Used/Total)'
        hdr[2].text = 'RAM (Used/Total)'
        
        for s in server_data:
            row = table.add_row().cells
            row[0].text = s['IP']
            row[1].text = f"{int(s['vCPU']*s['Load_CPU']/100)}/{s['vCPU']} ({s['Load_CPU']}%)"
            row[2].text = f"{int(s['RAM_GB']*s['Load_RAM']/100)}/{s['RAM_GB']} ({s['Load_RAM']}%)"
            
        doc.add_paragraph(f"\nTổng Storage Data đang dùng: {current_storage_used_data} GB")

        # 2. Sizing Result
        doc.add_heading('2. Đề xuất Kiến trúc & Tài nguyên', level=1)
        doc.add_paragraph(f'Số lượng Node đề xuất: {proposed_n}')
        doc.add_paragraph(f'Tổng Storage khả dụng cần thiết (Usable): {final_total_disk_data} GB')
        
        doc.add_heading('3. Cấu hình chi tiết', level=1)
        t2 = doc.add_table(rows=1, cols=2)
        t2.style = 'Table Grid'
        
        def add_row(label, value):
            r = t2.add_row().cells
            r[0].text = label
            r[1].text = value
            
        add_row('vCPU (mỗi Server)', f"{per_node_cpu} vCPU")
        add_row('RAM (mỗi Server)', f"{per_node_ram} GB")
        
        if db_type == "Oracle RAC":
            add_row('Storage', f"{final_total_disk_data} GB (Shared)")
            doc.add_paragraph('\nGhi chú Storage: Dung lượng trên là Usable Capacity cần thiết trên hệ thống NAS/SAN, được mount chung (Shared) cho tất cả các node trong cụm RAC (Sử dụng ASM).')
        else:
            add_row('Storage (mỗi Server)', f"{final_total_disk_data}")
            doc.add_paragraph(f'\nGhi chú Storage: Tổng {final_total_disk_data}GB được chia đều hoặc replicate giữa các node.')

        doc.add_paragraph(f'\nTham số an toàn: Growth Factor {growth_factor}, Max CPU {cpu_threshold*100}%, Max RAM {ram_threshold*100}%, Max Disk {disk_threshold*100}%')

        buffer = BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        
        st.download_button(
            "Tải Báo cáo Sizing (.docx)", 
            data=buffer, 
            file_name=f"Sizing_{db_type}_v5.docx"
        )