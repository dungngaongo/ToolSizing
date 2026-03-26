package com.example.demo.service;

import com.example.demo.model.Project;
import com.example.demo.model.ProjectData;
import com.example.demo.repository.ProjectDataRepository;
import com.example.demo.repository.ProjectRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static java.util.Map.entry;

class ExportServiceTest {

    @Test
    void exportIncludesLogicComponentTable() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        Map<String, Object> moHinh = Map.of(
                "logicalImages", List.of(),
                "physicalImages", List.of(),
                "flowImages", List.of(),
                "logicComponentRows", List.of(
                        Map.of("componentName", "Auth Service", "mainTask", "Xu ly dang nhap"),
                        Map.of("componentName", "Billing", "mainTask", "Tinh phi")
                ),
                "archRows", List.of(),
                "connectionRows", List.of()
        );

        byte[] docx = exportWithData(
                mapper,
                mapper.writeValueAsString(moHinh),
                mapper.writeValueAsString(Map.of()),
                null,
                null
        );

        String text = extractText(docx);
        assertTrue(text.contains("Thành phần mô hình Logic"));
        assertTrue(text.contains("Auth Service"));
        assertTrue(text.contains("Xu ly dang nhap"));
    }

    @Test
    void exportIncludesAllMariaDbInstancesFromModuleInstances() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        Map<String, Object> moHinh = Map.of(
                "logicalImages", List.of(),
                "physicalImages", List.of(),
                "flowImages", List.of(),
                "logicComponentRows", List.of(),
                "connectionRows", List.of(),
                "archRows", List.of(
                        Map.of("moduleName", "DB Primary", "loaiModule", "MariaDB"),
                        Map.of("moduleName", "DB Replica", "loaiModule", "MariaDB")
                )
        );

        String resultHtml = "<table><tbody>"
                + "<tr><td><strong>MariaDB</strong></td>"
                + "<td><ul><li><strong>8 vCPU</strong></li><li><strong>16 GB RAM</strong></li><li>/data: 100 GB</li><li>/log: 50 GB</li></ul></td>"
                + "<td class=\"text-center\"><strong>3</strong></td><td>Asynchronous</td></tr>"
                + "</tbody></table>";

        Map<String, Object> dinhCo = Map.of(
                "moduleInstances", List.of(
                        Map.of(
                                "moduleType", "MariaDB",
                                "moduleName", "DB Primary",
                                "instanceKey", "MariaDB-1",
                                "data", Map.of(
                                        "note", "Primary cluster",
                                        "replicationModel", "asynchronous",
                                        "inputCCU", "1000",
                                        "sizingCCU", "2000",
                                        "selectedInputRow", "0",
                                        "refTable", List.of(
                                                Map.of(
                                                        "ip", "10.0.0.1",
                                                        "cpu", "8",
                                                        "ram", "16",
                                                        "cpuLoad", "70",
                                                        "ramLoad", "75",
                                                        "isMaster", true,
                                                        "evidenceImages", List.of()
                                                )
                                        ),
                                        "storage", Map.of(
                                                "dataUsed", "100",
                                                "logUsed", "50",
                                                "soBanBackup", "2",
                                                "tiLeNen", "100",
                                                "evidenceImages", List.of()
                                        ),
                                        "resultHTML", resultHtml
                                )
                        ),
                        Map.of(
                                "moduleType", "MariaDB",
                                "moduleName", "DB Replica",
                                "instanceKey", "MariaDB-2",
                                "data", Map.of(
                                        "note", "Replica cluster",
                                        "replicationModel", "multi-master",
                                        "inputCCU", "500",
                                        "sizingCCU", "1200",
                                        "selectedInputRow", "1",
                                        "refTable", List.of(
                                                Map.of(
                                                        "ip", "10.0.0.2",
                                                        "cpu", "8",
                                                        "ram", "16",
                                                        "cpuLoad", "60",
                                                        "ramLoad", "65",
                                                        "isMaster", true,
                                                        "evidenceImages", List.of()
                                                )
                                        ),
                                        "storage", Map.of(
                                                "dataUsed", "120",
                                                "logUsed", "40",
                                                "soBanBackup", "3",
                                                "tiLeNen", "80",
                                                "evidenceImages", List.of()
                                        ),
                                        "resultHTML", resultHtml
                                )
                        )
                )
        );

        byte[] docx = exportWithData(
                mapper,
                mapper.writeValueAsString(moHinh),
                mapper.writeValueAsString(dinhCo),
                null,
                null
        );

        String text = extractText(docx);
        assertTrue(text.contains("Module MariaDB - DB Primary"));
        assertTrue(text.contains("Module MariaDB - DB Replica"));
        assertTrue(text.contains("Mô hình replication:"));
        assertTrue(text.contains("Master-Slave (Asynchronous)"));
        assertTrue(text.contains("Active-Active (Multi-Master)"));
        assertTrue(text.contains("Primary cluster"));
        assertTrue(text.contains("Replica cluster"));
    }

    @Test
    void exportIncludesAllAppInstancesAndCurrentAppFields() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        Map<String, Object> moHinh = Map.of(
                "logicalImages", List.of(),
                "physicalImages", List.of(),
                "flowImages", List.of(),
                "logicComponentRows", List.of(),
                "connectionRows", List.of(),
                "archRows", List.of(
                        Map.of("moduleName", "App Core", "loaiModule", "App"),
                        Map.of("moduleName", "App Batch", "loaiModule", "App")
                )
        );

        String sizingHtml = "<table><tbody><tr><td style='text-align:center'>1</td><td>Cint CPU yêu cầu</td><td style='text-align:center'>12</td></tr></tbody></table>";

        Map<String, Object> dinhCo = Map.of(
                "moduleInstances", List.of(
                        Map.of(
                                "moduleType", "App",
                                "moduleName", "App Core",
                                "instanceKey", "App-1",
                                "data", Map.ofEntries(
                                        entry("selectedInputRow", "0"),
                                        entry("pocValue", "1000"),
                                        entry("sizingValue", "2500"),
                                        entry("virtualizationMode", "ram"),
                                        entry("vcpuFlavor", "8"),
                                        entry("ramFlavor", "32"),
                                        entry("flavorEval", "OK"),
                                        entry("flavorNote", "Flavor hop ly"),
                                        entry("baselineTable", List.of(
                                                Map.of(
                                                        "ip", "10.10.0.1",
                                                        "cpu", "8",
                                                        "ram", "32",
                                                        "disk", "500",
                                                        "cintRate", "120",
                                                        "evidenceImages", List.of()
                                                )
                                        )),
                                        entry("inputConfigTable", List.of(
                                                Map.of(
                                                        "ip", "10.10.0.1",
                                                        "cpuLoad", "70",
                                                        "ramLoad", "80",
                                                        "diskLoad", "60",
                                                        "cintUsed", "84",
                                                        "ramUsed", "25.6",
                                                        "diskUsed", "300",
                                                        "evidenceImages", List.of()
                                                )
                                        )),
                                        entry("sizingResult", sizingHtml)
                                )
                        ),
                        Map.of(
                                "moduleType", "App",
                                "moduleName", "App Batch",
                                "instanceKey", "App-2",
                                "data", Map.ofEntries(
                                        entry("selectedInputRow", "1"),
                                        entry("pocValue", "500"),
                                        entry("sizingValue", "1500"),
                                        entry("virtualizationMode", "vcpu"),
                                        entry("vcpuFlavor", "16"),
                                        entry("ramFlavor", "64"),
                                        entry("flavorEval", "NOK"),
                                        entry("flavorNote", "Can xem lai"),
                                        entry("baselineTable", List.of(
                                                Map.of(
                                                        "ip", "10.10.0.2",
                                                        "cpu", "16",
                                                        "ram", "64",
                                                        "disk", "1000",
                                                        "cintRate", "240",
                                                        "evidenceImages", List.of()
                                                )
                                        )),
                                        entry("inputConfigTable", List.of(
                                                Map.of(
                                                        "ip", "10.10.0.2",
                                                        "cpuLoad", "50",
                                                        "ramLoad", "55",
                                                        "diskLoad", "40",
                                                        "cintUsed", "120",
                                                        "ramUsed", "35.2",
                                                        "diskUsed", "400",
                                                        "evidenceImages", List.of()
                                                )
                                        )),
                                        entry("sizingResult", sizingHtml)
                                )
                        )
                )
        );

        byte[] docx = exportWithData(
                mapper,
                mapper.writeValueAsString(moHinh),
                mapper.writeValueAsString(dinhCo),
                null,
                null
        );

        String text = extractText(docx);
        assertTrue(text.contains("Module App - App Core"));
        assertTrue(text.contains("Module App - App Batch"));
        assertTrue(text.contains("Dòng đầu vào đã chọn:"));
        assertTrue(text.contains("Chế độ ảo hóa:"));
        assertTrue(text.contains("Flavor vCPU đã chọn:"));
        assertTrue(text.contains("Flavor RAM đã chọn:"));
        assertTrue(text.contains("Đánh giá flavor:"));
        assertTrue(text.contains("Ghi chú flavor:"));
        assertTrue(text.contains("Theo RAM"));
        assertTrue(text.contains("Theo vCPU"));
    }

    @Test
    void exportIncludesMultipleInstancesForAllRemainingModules() throws Exception {
        ObjectMapper mapper = new ObjectMapper();

        Map<String, Object> moHinh = Map.of(
                "logicalImages", List.of(),
                "physicalImages", List.of(),
                "flowImages", List.of(),
                "logicComponentRows", List.of(),
                "connectionRows", List.of(),
                "archRows", List.of(
                        Map.of("moduleName", "Redis A", "loaiModule", "Redis"),
                        Map.of("moduleName", "Redis B", "loaiModule", "Redis"),
                        Map.of("moduleName", "Kafka A", "loaiModule", "Kafka"),
                        Map.of("moduleName", "Kafka B", "loaiModule", "Kafka"),
                        Map.of("moduleName", "K8S A", "loaiModule", "K8S"),
                        Map.of("moduleName", "K8S B", "loaiModule", "K8S"),
                        Map.of("moduleName", "LBFW A", "loaiModule", "LB/FW"),
                        Map.of("moduleName", "LBFW B", "loaiModule", "LB/FW")
                )
        );

        Map<String, Object> dinhCo = Map.of(
                "moduleInstances", List.of(
                        Map.of("moduleType", "Redis", "moduleName", "Redis A", "instanceKey", "Redis-1", "data", Map.of()),
                        Map.of("moduleType", "Redis", "moduleName", "Redis B", "instanceKey", "Redis-2", "data", Map.of()),
                        Map.of("moduleType", "Kafka", "moduleName", "Kafka A", "instanceKey", "Kafka-1", "data", Map.of()),
                        Map.of("moduleType", "Kafka", "moduleName", "Kafka B", "instanceKey", "Kafka-2", "data", Map.of()),
                        Map.of("moduleType", "K8S", "moduleName", "K8S A", "instanceKey", "K8S-1", "data", Map.of()),
                        Map.of("moduleType", "K8S", "moduleName", "K8S B", "instanceKey", "K8S-2", "data", Map.of()),
                        Map.of("moduleType", "LB/FW", "moduleName", "LBFW A", "instanceKey", "LBFW-1", "data", Map.of()),
                        Map.of("moduleType", "LB/FW", "moduleName", "LBFW B", "instanceKey", "LBFW-2", "data", Map.of())
                )
        );

        byte[] docx = exportWithData(
                mapper,
                mapper.writeValueAsString(moHinh),
                mapper.writeValueAsString(dinhCo),
                null,
                null
        );

        String text = extractText(docx);
        assertTrue(text.contains("Module Redis - Redis A"));
        assertTrue(text.contains("Module Redis - Redis B"));
        assertTrue(text.contains("Module Kafka - Kafka A"));
        assertTrue(text.contains("Module Kafka - Kafka B"));
        assertTrue(text.contains("Module K8S - K8S A"));
        assertTrue(text.contains("Module K8S - K8S B"));
        assertTrue(text.contains("Module LB/FW - LBFW A"));
        assertTrue(text.contains("Module LB/FW - LBFW B"));
    }

    private byte[] exportWithData(
            ObjectMapper mapper,
            String moHinhHeThongContent,
            String dinhCoHeThongContent,
            String yeuCauBaiToanContent,
            String thongTinDauVaoContent
    ) throws IOException {
        Project project = new Project();
        project.setId("project-1");
        project.setName("Demo Project");

        ProjectData projectData = new ProjectData();
        projectData.setProject(project);
        projectData.setMoHinhHeThongContent(moHinhHeThongContent);
        projectData.setDinhCoHeThongContent(dinhCoHeThongContent);
        projectData.setYeuCauBaiToanContent(yeuCauBaiToanContent);
        projectData.setThongTinDauVaoContent(thongTinDauVaoContent);

        ProjectRepository projectRepository = mock(ProjectRepository.class);
        ProjectDataRepository projectDataRepository = mock(ProjectDataRepository.class);

        when(projectRepository.findById("project-1")).thenReturn(Optional.of(project));
        when(projectDataRepository.findFirstByProjectId("project-1")).thenReturn(Optional.of(projectData));

        ExportService service = new ExportService(projectRepository, projectDataRepository, mapper);
        return service.exportToDocx("project-1");
    }

    private String extractText(byte[] docx) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docx));
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText();
        }
    }
}
