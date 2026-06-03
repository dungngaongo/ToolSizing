---
name: sonarqube-mcp-issue-fixer
description: use this skill only when the user explicitly asks Codex to fetch, analyze, triage, or fix sonarqube issues through a configured sonarqube mcp server, including prompts mentioning sonarqube issues, sonar mcp, mcp__sonarqube__issues, quality gate issues, or fixing code based on sonarqube findings. do not use this skill for general coding, refactoring, testing, build errors, code review, or normal debugging unless the task is specifically driven by sonarqube issues.
---

# SonarQube MCP Issue Fixer

## Mục tiêu

Sử dụng SonarQube MCP một cách an toàn để lấy, phân loại và sửa issues theo đúng project/branch của repository hiện tại. Skill này chỉ áp dụng cho workflow xử lý SonarQube issues; không áp dụng cho tác vụ code thông thường.

## Nguyên tắc kích hoạt

Chỉ áp dụng skill này khi user yêu cầu rõ ràng một trong các việc sau:

- Lấy, liệt kê, phân tích, phân loại hoặc sửa SonarQube issues.
- Làm việc với SonarQube MCP hoặc các tool dạng `mcp__sonarqube__...`.
- Kiểm tra quality gate, code smells, vulnerabilities, bugs hoặc technical debt dựa trên SonarQube.
- Sửa code theo danh sách issues được lấy từ SonarQube.

Không áp dụng skill này khi user chỉ yêu cầu:

- Viết code mới, refactor chung, debug lỗi runtime, sửa test/build, review code thông thường.
- Tối ưu hiệu năng hoặc cải thiện kiến trúc không dựa trên SonarQube.
- Giải thích code hoặc thêm tính năng không liên quan SonarQube.

## Bắt buộc đọc cấu hình từ `.env`

Trước mọi thao tác với SonarQube MCP, luôn đọc file `.env` tại project root và lấy các biến sau:

- `SONARQUBE_URL`
- `SONARQUBE_TOKEN`
- `SONARQUBE_PROJECT_KEY`
- `SONARQUBE_BRANCH`

Không được hard-code project key, branch, URL hoặc token trong prompt, code, script, command, log, hoặc MCP call.

Nếu thiếu `SONARQUBE_PROJECT_KEY` hoặc `SONARQUBE_BRANCH`, dừng workflow và yêu cầu user bổ sung `.env`. Không gọi SonarQube MCP khi thiếu hai giá trị này.

Nếu thiếu `SONARQUBE_URL` hoặc `SONARQUBE_TOKEN`, vẫn không được tự đoán hoặc hard-code. Báo rõ biến nào đang thiếu. Nếu MCP server đã được cấu hình auth riêng bên ngoài `.env`, vẫn phải dùng `.env` để lấy project key và branch.

Không in token ra màn hình, log, diff, commit message hoặc báo cáo.

## Bắt buộc filter đúng project và branch

Mọi MCP call tới SonarQube để lấy issues, source code, measures hoặc quality gate phải luôn dùng đúng:

- project key = giá trị `SONARQUBE_PROJECT_KEY`
- branch = giá trị `SONARQUBE_BRANCH`

Nếu MCP tool hỗ trợ tham số `branch`, luôn truyền `branch`.

Ví dụ tham số bắt buộc khi lấy issues:

```json
{
  "projects": ["${SONARQUBE_PROJECT_KEY}"],
  "branch": "${SONARQUBE_BRANCH}",
  "statuses": ["OPEN", "CONFIRMED", "REOPENED"],
  "facets": ["severities", "types", "files"],
  "facet_mode": "count"
}
```

Không gọi SonarQube ở phạm vi toàn server nếu user chỉ yêu cầu xử lý repository hiện tại.

## Workflow chính

Khi user yêu cầu sửa SonarQube issues, thực hiện tuần tự 4 phase dưới đây.

### Phase 1: Discovery - khám phá vấn đề

1. Đọc `.env` tại project root.
2. Validate các biến bắt buộc:
   - `SONARQUBE_PROJECT_KEY`
   - `SONARQUBE_BRANCH`
   - `SONARQUBE_URL`
   - `SONARQUBE_TOKEN`
3. Gọi `mcp__sonarqube__issues` để fetch issues với các tham số:
   - `projects`: mảng chứa đúng `SONARQUBE_PROJECT_KEY`
   - `branch`: đúng `SONARQUBE_BRANCH`
   - `statuses`: mặc định `OPEN`, `CONFIRMED`, `REOPENED`
   - `facets`: `severities`, `types`, `files`
   - `facet_mode`: `count`
   - `severities`: chỉ truyền khi user yêu cầu lọc severity cụ thể
   - `component_keys` hoặc `files`: chỉ truyền khi user yêu cầu file/component cụ thể
4. Phân loại issues:
   - Sort theo severity: `CRITICAL` → `BLOCKER` → `MAJOR` → `MINOR` → `INFO`
   - Group theo component hoặc file path
   - Parse facet results để đếm issue theo severity, type và file
5. Báo cáo tóm tắt trước khi sửa.

Mẫu báo cáo discovery:

```text
Đã tìm thấy X issues trong Y files cho project SONARQUBE_PROJECT_KEY, branch SONARQUBE_BRANCH:
- CRITICAL: A (security: a1, bugs: a2, code_smells: a3)
- BLOCKER: B (security: b1, bugs: b2, code_smells: b3)
- MAJOR: C
- MINOR: D
- INFO: E

Top files có nhiều issues:
1. path/to/file1.ext - N issues
2. path/to/file2.ext - M issues
```

### Phase 2: Confirmation - bán tự động

Không tự sửa ngay sau discovery trừ khi user đã yêu cầu rất rõ phạm vi sửa. Luôn xác nhận chiến lược trước khi edit code.

Hỏi user một câu rõ ràng:

```text
Bạn muốn sửa tất cả issues hay chọn theo severity/file cụ thể?
```

Nếu user chọn sửa tất cả:

- Xác nhận theo từng severity group.
- Thứ tự xử lý: `CRITICAL` → `BLOCKER` → `MAJOR` → `MINOR` → `INFO`.
- Ví dụ: `Tìm thấy 3 CRITICAL issues trong 2 files. Bắt đầu sửa nhóm CRITICAL trước? (y/n)`

Nếu user chọn file cụ thể:

- Tóm tắt issues trong file đó.
- Hỏi: `File X có Y issues. Sửa tất cả issues trong file này? (y/n)`
- Nếu user trả lời `n`, hỏi chọn từng issue hoặc chọn severity.

Nếu user chọn severity cụ thể:

- Chỉ xử lý severity đó.
- Không tự động chuyển sang severity khác nếu chưa được xác nhận.

### Phase 3: Fixing - sửa lỗi

#### Quy tắc chunking bắt buộc

Không bao giờ cố xử lý quá nhiều lỗi cùng lúc.

Quy tắc vàng:

1. Xác định nhóm lỗi và số lượng cần xử lý.
2. Xử lý từng issue một, hoặc nhóm nhỏ 2-3 issues nếu chúng cùng file và cùng loại.
3. Yêu cầu user review sau mỗi issue hoặc batch nhỏ.
4. Chỉ tiếp tục issue tiếp theo sau khi user xác nhận OK.
5. Nếu user reject, dừng lại và thảo luận approach khác.

Mẫu workflow:

```text
Đã xác định 15 issues. Tôi sẽ fix từng issue một và chờ review của bạn.

✓ Đã sửa issue #1: SQL Injection trong main.py:45
Vui lòng review code change này. OK để tiếp tục issue tiếp theo? (y/n)
```

#### Cách sửa từng issue

Với mỗi issue hoặc batch nhỏ:

1. Dùng `mcp__sonarqube__source_code` để xem code liên quan nếu tool hỗ trợ.
   - Luôn truyền `branch` nếu có.
   - Dùng `key` đúng dạng project/component mà SonarQube trả về.
   - Chỉ lấy range dòng cần thiết để tiết kiệm context.
2. Đọc file local tương ứng trong repository.
3. Xác định nguyên nhân issue và phương án sửa tối thiểu.
4. Preserve behavior, code style, formatting và public API hiện có.
5. Edit code ở phạm vi nhỏ nhất đủ để fix issue.
6. Nếu có test/lint phù hợp và chi phí hợp lý, chạy test/lint liên quan.
7. Báo cáo diff/ý nghĩa thay đổi cho user.
8. Chờ user xác nhận trước khi tiếp tục.

#### Khi được phép group issues

Chỉ group 2-3 issues khi tất cả điều kiện sau đúng:

- Cùng file.
- Cùng loại issue hoặc cùng root cause.
- Fix là cơ học, ít rủi ro, ví dụ: unused imports, duplicated literal đơn giản, formatting nhỏ.

Nếu có hơn 5 issues trong cùng file, chia thành batches nhỏ 3-5 issues/batch và xác nhận sau mỗi batch.

#### Khi phải hỏi trước khi sửa

Hỏi user trước khi edit nếu gặp một trong các trường hợp:

- Fix có thể thay đổi business logic.
- Cần đổi API, schema, config, query, permission hoặc behavior runtime.
- Cần thêm dependency mới.
- Không chắc SonarQube issue có phải false positive hay không.
- Không tìm thấy file local tương ứng với component SonarQube.
- Issue liên quan security nhưng remediation không rõ ràng.

#### Khi phải dừng

Dừng workflow và báo user nếu:

- `.env` thiếu project key hoặc branch.
- MCP SonarQube không kết nối được.
- SonarQube trả lỗi auth/permission.
- Source code local không khớp branch được scan trên SonarQube.
- Edit gây syntax error hoặc test/lint fail mà chưa rõ cách sửa an toàn.
- User không xác nhận tiếp tục sau một issue/batch.

### Phase 4: Completion - hoàn thành

Khi kết thúc, báo cáo tổng kết rõ ràng.

Mẫu summary:

```text
=== SUMMARY ===
✓ Đã sửa tổng cộng: X issues
✓ Files đã chỉnh sửa:
  - file1.py (Y issues)
  - file2.py (Z issues)

✓ Đã kiểm tra:
  - test/lint command nếu có
  - MCP connection hoặc quality gate nếu đã chạy

Chưa làm:
  - các issues bị user bỏ qua
  - các issues cần xác nhận thêm

Next step: review code và commit khi sẵn sàng.
```

Không tuyên bố issue đã được SonarQube resolved nếu chưa có scan lại hoặc verification rõ ràng.

## MCP tools sử dụng

### Core tools

| Tool | Mục đích | Tham số quan trọng |
| --- | --- | --- |
| `mcp__sonarqube__issues` | Fetch, filter, phân loại issues | `projects`, `branch`, `statuses`, `severities`, `facets`, `facet_mode`, `component_keys`, `files` |
| `mcp__sonarqube__source_code` | Xem source code theo component/range | `key`, `from`, `to`, `branch` |

### Supporting tools

| Tool | Mục đích | Khi dùng |
| --- | --- | --- |
| `mcp__sonarqube__measures_component` | Lấy metrics như complexity, coverage, technical debt | Khi cần đánh giá thêm trước/sau fix |
| `mcp__sonarqube__quality_gate_status` | Kiểm tra quality gate | Khi cần xem health tổng thể của project/branch |

### Specialized tools

| Tool | Mục đích | Khi dùng |
| --- | --- | --- |
| `mcp__sonarqube__system_ping` | Kiểm tra server có phản hồi không | Khi nghi ngờ lỗi kết nối |
| `mcp__sonarqube__system_health` | Kiểm tra system health | Khi troubleshooting server |

## Priority order

Fix issues theo thứ tự ưu tiên:

1. `CRITICAL` - security vulnerabilities, data loss risks
2. `BLOCKER` - blocks development/deployment
3. `MAJOR` - significant bugs, code smells
4. `MINOR` - minor issues, style problems
5. `INFO` - informational improvements

Nếu user đưa thứ tự ưu tiên khác, làm theo user nhưng vẫn báo rõ khác biệt với mặc định.

## Quy tắc giao tiếp với user

- Nói ngắn gọn, tập trung vào issue, file, dòng và rủi ro của fix.
- Không dump toàn bộ issue list nếu quá dài; tóm tắt và hỏi phạm vi xử lý.
- Không expose token hoặc thông tin nhạy cảm từ `.env`.
- Luôn nêu rõ đang xử lý project key và branch nào, nhưng không in token.
- Sau mỗi issue hoặc batch nhỏ, hỏi xác nhận tiếp tục.

## Checklist bắt buộc trước mỗi MCP call

Trước khi gọi SonarQube MCP, tự kiểm tra:

- Đã đọc `.env` từ project root chưa?
- Có `SONARQUBE_PROJECT_KEY` chưa?
- Có `SONARQUBE_BRANCH` chưa?
- MCP call có truyền đúng `projects` hoặc `project_key` chưa?
- MCP call có truyền `branch` nếu tool hỗ trợ chưa?
- Có tránh hard-code URL/token/project/branch chưa?

Nếu bất kỳ câu trả lời nào là không, dừng lại và sửa trước khi gọi MCP.
