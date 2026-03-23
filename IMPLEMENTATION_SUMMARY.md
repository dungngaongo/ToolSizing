# 📋 KẾ HOẠCH TRIỂN KHAI AI BOT NỘI BỘ - PYTHON BASED

## 1. GIỚI THIỆU

### 1.1 Mục đích
Tài liệu này mô tả kế hoạch chi tiết triển khai AI Bot nội bộ sử dụng Python, tích hợp vào hệ thống Sizing Tool hiện có. AI Bot sẽ hỗ trợ:
- Tự động thẩm định dự án (Sizing review)
- Phân tích và đề xuất cấu hình
- Chatbot hỗ trợ người dùng
- Lưu trữ và truy xuất tri thức (RAG)

### 1.2 Phạm vi
- Backend: Python FastAPI service chạy riêng
- AI: Gọi API AI nội bộ (OpenAI-compatible)
- RAG: ChromaDB lưu vector embeddings
- Integration: Kết nối với Spring Boot backend hiện có

---

## 2. KIẾN TRÚC HỆ THỐNG

### 2.1 Sơ đồ tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Frontend   │  │  Dashboard  │  │   Chat UI   │            │
│  │  (HTML/JS)  │  │   (Admin)   │  │  (Future)   │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              NGINX REVERSE PROXY (Port 80)              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Spring Boot   │  │   Python AI     │  │    MySQL        │
│   Backend1      │  │   Bot           │  │    Database     │
│   (Port 8081)   │  │   (Port 8000)   │  │    (Port 3306)  │
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ▼                     ▼
            ┌─────────────────┐  ┌─────────────────┐
            │   AI Nội Bộ     │  │   ChromaDB      │
            │   (External)    │  │   (RAG Store)   │
            │   Port 8401     │  │   (Embedded)    │
            └─────────────────┘  └─────────────────┘  

```

### 2.2 Các thành phần chính

| Thành phần | Công nghệ | Chức năng |
|------------|-----------|-----------|
| **API Gateway** | FastAPI | Tiếp nhận request từ frontend, điều phối xử lý |
| **AI Service** | HTTPX + OpenAI SDK | Gọi AI nội bộ, xử lý response |
| **Backend1 Service** | HTTPX | Giao tiếp với Spring Boot API |
| **RAG Service** | ChromaDB + SentenceTransformers | Lưu trữ và truy xuất tri thức |
| **Agents** | LangChain (optional) | Logic nghiệp vụ AI cho từng tác vụ |

---

## 3. CẤU TRÚC THƯ MỤC

### 3.1 Cây thư mục chi tiết

```
demo/
├── aibot/                          # ⭐ PYTHON AI BOT SERVICE
│   ├── .env                        # Environment variables (KHÔNG commit)
│   ├── .env.example                # Mẫu environment variables
│   ├── .gitignore                  # Git ignore rules
│   ├── requirements.txt            # Python dependencies
│   ├── main.py                     # FastAPI application entry point
│   ├── Dockerfile                  # Docker build configuration
│   │
│   ├── config/                     # Cấu hình application
│   │   ├── __init__.py
│   │   ├── settings.py             # Load từ .env, validation
│   │   └── logging_config.py       # Logging configuration
│   │
│   ├── services/                   # Business logic services
│   │   ├── __init__.py
│   │   ├── ai_service.py           # Gọi AI nội bộ (OpenAI-compatible API)
│   │   ├── backend1_service.py     # Gọi Spring Boot REST API
│   │   ├── project_analyzer.py     # Phân tích dự án (orchestrate AI calls)
│   │   └── training_processor.py   # Xử lý dữ liệu training cho RAG
│   │
│   ├── agents/                     # AI Agents cho từng tác vụ
│   │   ├── __init__.py
│   │   ├── sizing_agent.py         # Agent thẩm định sizing
│   │   ├── security_agent.py       # Agent kiểm tra bảo mật
│   │   └── code_agent.py           # Agent phân tích code
│   │
│   ├── rag/                        # Retrieval-Augmented Generation
│   │   ├── __init__.py
│   │   ├── vector_store.py         # ChromaDB operations
│   │   ├── embeddings.py           # SentenceTransformers wrapper
│   │   └── knowledge_base.py       # Quản lý tri thức tổng hợp
│   │
│   ├── models/                     # Pydantic data models
│   │   ├── __init__.py
│   │   ├── requests.py             # Request schemas
│   │   └── responses.py            # Response schemas
│   │
│   └── utils/                      # Utility functions
│       ├── __init__.py
│       └── logger.py               # Logger setup
│
├── docker-compose.yml              # ⭐ CẬP NHẬT: Thêm aibot service
└── ... (các thành phần hiện có giữ nguyên)
```

### 3.2 Mô tả chi tiết từng file

#### **aibot/.env** (KHÔNG commit)
```
# AI nội bộ
AI_INNER_BASE_URL=http://10.221.58.70:8401/v1
AI_INNER_API_KEY=sk--QpfcNNqdiXG2CY13o05sQ
AI_MODEL_NAME=Qwen/Qwen3.5-397B-A17B-FP8
AI_REQUEST_TIMEOUT=60
AI_MAX_RETRIES=3
AI_RETRY_DELAY=5
AI_DEBUG=false

# Spring Boot Backend
SPRING_BOOT_URL=http://backend1:8081/api

# RAG Configuration
CHROMA_PERSIST_DIR=/app/data/chroma
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Server Settings
AIBOT_PORT=8000
LOG_LEVEL=INFO
ALLOWED_ORIGINS=http://localhost,http://localhost:80
```

#### **aibot/requirements.txt**
```
# Web Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0

# HTTP Client
httpx==0.26.0

# Configuration
python-dotenv==1.0.0
pydantic==2.5.0
pydantic-settings==2.1.0

# AI & RAG (Optional)
langchain==0.1.0
chromadb==0.4.0
sentence-transformers==2.2.2

# Utilities
python-multipart==0.0.6
aiofiles==23.2.1
```

#### **aibot/main.py** (Entry point)
- Khởi tạo FastAPI application
- Cấu hình CORS middleware
- Khởi động các services (AI, Backend1, RAG)
- Định nghĩa API endpoints
- Setup event handlers (startup, shutdown)

#### **aibot/config/settings.py**
- Load environment variables từ .env
- Validation các required settings
- Cung cấp typed settings object cho toàn app

#### **aibot/services/ai_service.py**
- Wrapper quanh HTTP client gọi AI API
- Xử lý retry logic, timeout
- Format prompts cho các use cases khác nhau
- Parse và validate AI responses

#### **aibot/services/backend1_service.py**
- HTTP client gọi Spring Boot REST API
- Methods: get_project, get_project_data, save_analysis
- Xử lý authentication nếu cần

#### **aibot/services/project_analyzer.py**
- Orchestrates AI analysis workflow
- Kết hợp multiple AI calls cho phân tích toàn diện
- Aggregate results từ nhiều sections

#### **aibot/rag/vector_store.py**
- ChromaDB client wrapper
- CRUD operations cho vectors
- Similarity search

#### **aibot/rag/embeddings.py**
- SentenceTransformers wrapper
- Batch embedding generation
- Cache embeddings

#### **aibot/agents/sizing_agent.py**
- Prompt templates cho sizing review
- Logic đánh giá từng section
- Generate recommendations

---

## 4. API DESIGN

### 4.1 Endpoints tổng quan

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/analyze-project` | Phân tích dự án |
| POST | `/api/chat` | Chat với AI (streaming) |
| POST | `/api/rag-query` | Truy vấn RAG |
| POST | `/api/process-training-data` | Xử lý training data |
| GET | `/api/projects/{id}/analysis` | Lấy kết quả phân tích |

### 4.2 Request/Response schemas

#### **POST /api/analyze-project**

**Request Body:**
```json
{
  "project_id": "12345",
  "analysis_type": "full",
  "options": {
    "include_recommendations": true,
    "include_security_review": false
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "project_id": "12345",
    "analyzed_at": "2024-01-15T10:30:00Z",
    "overall_score": 85,
    "sections": {
      "request": {
        "score": 90,
        "status": "good",
        "feedback": "Yêu cầu bài toán rõ ràng...",
        "issues": [],
        "suggestions": []
      },
      "input": {
        "score": 80,
        "status": "needs_improvement",
        "feedback": "Thông tin đầu vào thiếu...",
        "issues": ["Thiếu ảnh sở cứ"],
        "suggestions": ["Bổ sung ảnh monitoring"]
      }
    },
    "recommendations": [
      "Bổ sung thông tin contact person",
      "Thêm ảnh sở cứu cho phần baseline"
    ]
  }
}
```

#### **POST /api/chat**

**Request Body:**
```json
{
  "message": "Dự án này có vấn đề gì?",
  "context": {
    "project_id": "12345",
    "section": "sizing"
  },
  "stream": true
}
```

**Response (Streaming):**
```
data: {"chunk": "Dự án này có một số vấn đề cần lưu ý:\n\n"}
data: {"chunk": "1. Thiếu thông tin về baseline...\n"}
data: {"chunk": "2. Cấu hình Redis chưa tối ưu...\n"}
data: {"done": true}
```

---

## 5. LUỒNG XỬ LÝ CHI TIẾT

### 5.1 Luồng AI Thẩm Định Dự Án

```
Bước 1: User → Frontend
  - User bấm "AI Thẩm Định" trên giao diện
  
Bước 2: Frontend → AI Bot
  - POST http://localhost:8000/api/analyze-project
  - Body: { project_id: "123" }
  
Bước 3: AI Bot → Spring Boot
  - GET http://backend1:8081/api/project-data/project/123
  - Lấy toàn bộ dữ liệu dự án
  
Bước 4: AI Bot → RAG (Optional)
  - Query các dự án tương tự trong quá khứ
  - Lấy insights và patterns
  
Bước 5: AI Bot → AI Service
  - Build prompt với context đầy đủ
  - POST {AI_INNER_BASE_URL}/chat/completions
  - Body: { model, messages, temperature, max_tokens }
  
Bước 6: AI Service → AI Bot
  - Nhận response từ AI
  - Parse và validate kết quả
  
Bước 7: AI Bot → RAG
  - Lưu analysis vào vector store
  - Index cho future queries
  
Bước 8: AI Bot → Frontend
  - Return structured JSON response
  - Frontend hiển thị kết quả
```

### 5.2 Luồng Chat với AI

```
Bước 1: User → Chat UI
  - User nhập câu hỏi
  
Bước 2: Chat UI → AI Bot
  - POST http://localhost:8000/api/chat
  - Body: { message, context, stream: true }
  
Bước 3: AI Bot → RAG
  - Search relevant documents
  - Get top-k similar contexts
  
Bước 4: AI Bot → AI Service (Streaming)
  - Build prompt với retrieved context
  - Stream response chunks
  
Bước 5: AI Service → AI Bot → Chat UI
  - Stream từng chunk qua Server-Sent Events
  - UI hiển thị realtime
```

---

## 6. RAG DESIGN

### 6.1 Vector Store Schema

**Collection: `project_analyses`**
```
- id: string (project_id + timestamp)
- embedding: vector[384] (MiniLM-L6-v2)
- metadata: {
    project_id: string,
    section: string,
    analyzed_at: datetime,
    score: float
  }
- document: string (text content)
```

### 6.2 Embedding Strategy

**Text chunks cho từng section:**
- `yeuCauBaiToan`: JSON → text
- `thongTinDauVao`: JSON → text
- `moHinhHeThong`: JSON → text
- `dinhCoHeThong`: JSON → text
- `analysis_result`: AI analysis text

**Chunk size:** 512 tokens
**Overlap:** 50 tokens

### 6.3 Retrieval Strategy

**Query types:**
1. **Similarity search:** Tìm dự án tương tự
2. **Filtered search:** Theo section, score range
3. **Hybrid search:** Keyword + vector

---

## 7. DEPLOYMENT

### 7.1 Docker Compose Configuration

**Service definition:**
```yaml
aibot:
  build: ./aibot
  ports:
    - "8000:8000"
  environment:
    - AI_INNER_BASE_URL=${AI_INNER_BASE_URL}
    - AI_INNER_API_KEY=${AI_INNER_API_KEY}
    - SPRING_BOOT_URL=http://backend1:8081/api
    - CHROMA_PERSIST_DIR=/app/data/chroma
  volumes:
    - chroma_data:/app/data/chroma
  depends_on:
    - backend1
  networks:
    - app-network
  restart: unless-stopped
```

### 7.2 Network Architecture

```
┌─────────────────────────────────────────┐
│         Docker Bridge Network           │
│         (app-network)                   │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │  nginx   │──│  aibot   │──│ chroma│ │
│  │  :80     │  │  :8000   │  │ :embedded│ │
│  └──────────┘  └──────────┘  └───────┘ │
│       │              │                  │
│  ┌──────────┐  ┌──────────┐            │
│  │ backend1 │──│  mysql   │            │
│  │  :8081   │  │  :3306   │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  External AI    │
│  (10.x.x.x)     │
└─────────────────┘
```

### 7.3 Volume Mounts

| Volume | Mount Path | Purpose |
|--------|------------|---------|
| `chroma_data` | `/app/data/chroma` | Persist ChromaDB vectors |
| (optional) `logs` | `/app/logs` | Log files |

---

## 8. SECURITY CONSIDERATIONS

### 8.1 Authentication

**AI Bot → Spring Boot:**
- Sử dụng JWT token từ user session
- Hoặc service-to-service API key

**AI Bot → AI nội bộ:**
- API key trong .env
- Rotate định kỳ

### 8.2 Data Protection

- Không lưu sensitive data trong logs
- Mask API keys trong logs
- Validate input schemas nghiêm ngặt

### 8.3 Rate Limiting

- Giới hạn request/user/minute
- Circuit breaker cho AI calls
- Timeout configuration

---

## 9. MONITORING & LOGGING

### 9.1 Logging Strategy

**Log levels:**
- `DEBUG`: Chi tiết cho development
- `INFO`: Normal operations
- `WARNING`: Recoverable errors
- `ERROR`: Critical issues

**Log format:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "aibot",
  "message": "Project analysis completed",
  "context": {
    "project_id": "123",
    "duration_ms": 2500,
    "ai_model": "internal-model"
  }
}
```

### 9.2 Metrics to Track

- Request count per endpoint
- Average response time
- AI API error rate
- RAG search latency
- Cache hit rate

---

## 10. TESTING STRATEGY

### 10.1 Unit Tests

- Test individual services (AI, Backend1, RAG)
- Mock external dependencies
- Coverage target: 80%

### 10.2 Integration Tests

- Test API endpoints với mock data
- Test AI Bot ↔ Spring Boot integration
- Test RAG operations

### 10.3 E2E Tests

- Test toàn bộ luồng từ frontend
- Validate AI analysis output quality

---

## 11. TRIỂN KHAI TỪNG GIAI ĐOẠN

### Giai đoạn 1: Core Infrastructure (Tuần 1-2)
- [ ] Tạo cấu trúc thư mục aibot/
- [ ] Setup FastAPI project skeleton
- [ ] Implement AI Service (gọi AI nội bộ)
- [ ] Implement Backend1 Service
- [ ] Tạo basic endpoints: /health, /api/analyze-project
- [ ] Dockerize và tích hợp docker-compose

### Giai đoạn 2: AI Analysis (Tuần 3-4)
- [ ] Implement Project Analyzer service
- [ ] Tạo Sizing Agent với prompt templates
- [ ] Test và tinh chỉnh AI prompts
- [ ] Frontend integration (nút AI Thẩm Định)

### Giai đoạn 3: RAG Implementation (Tuần 5-6)
- [ ] Setup ChromaDB vector store
- [ ] Implement Embeddings service
- [ ] Build knowledge base pipeline
- [ ] Implement /api/rag-query endpoint

### Giai đoạn 4: Chat & Advanced Features (Tuần 7-8)
- [ ] Implement Chat endpoint (streaming)
- [ ] Tạo Security Agent
- [ ] Tạo Code Agent
- [ ] Performance optimization
- [ ] Documentation và handover

---

## 12. RỦI RO & GIẢI PHÁP

| Rủi ro | Impact | Mitigation |
|--------|--------|------------|
| AI nội bộ không ổn định | Cao | Implement retry logic, fallback |
| RAG performance chậm | Trung bình | Optimize chunk size, index |
| Frontend integration phức tạp | Trung bình | Cung cấp clear API docs |
| Data privacy concerns | Cao | Mask sensitive data, audit logs |

---

## 13. TÀI LIỆU THAM KHẢO

- FastAPI Documentation: https://fastapi.tiangolo.com/
- ChromaDB Documentation: https://docs.trychroma.com/
- LangChain Documentation: https://python.langchain.com/
- OpenAI API Reference: https://platform.openai.com/docs/api-reference

---

## 14. KẾT LUẬN

Tài liệu này cung cấp kế hoạch chi tiết triển khai AI Bot nội bộ sử dụng Python FastAPI. Kế hoạch được chia thành 4 giai đoạn rõ ràng, tổng thời gian dự kiến 8 tuần.

**Next Step:** Sau khi được phê duyệt kế hoạch này, sẽ chuyển sang giai đoạn implementation với việc tạo cấu trúc thư mục và các file cấu hình cơ bản.

---

*Tài liệu được tạo ngày: 17/03/2026*
*Version: 1.0*