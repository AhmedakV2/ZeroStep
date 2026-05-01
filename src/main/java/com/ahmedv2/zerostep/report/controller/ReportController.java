// src/main/java/com/ahmedv2/zerostep/report/controller/ReportController.java
package com.ahmedv2.zerostep.report.controller;

import com.ahmedv2.zerostep.common.response.ApiResponse;
import com.ahmedv2.zerostep.report.dto.*;
import com.ahmedv2.zerostep.report.service.ExcelReportGenerator;
import com.ahmedv2.zerostep.report.service.PdfReportGenerator;
import com.ahmedv2.zerostep.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final PdfReportGenerator pdfGenerator;
    private final ExcelReportGenerator excelGenerator;

    // ApiResponse.ok() — projedeki gerçek static method adı
    @GetMapping("/executions/{publicId}")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    public ResponseEntity<ApiResponse<ExecutionReportDto>> getExecutionReport(
            @PathVariable UUID publicId) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.buildExecutionReport(publicId)));
    }

    @GetMapping("/executions/{publicId}/export/pdf")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    public ResponseEntity<byte[]> exportPdf(@PathVariable UUID publicId) {
        ExecutionReportDto report = reportService.buildExecutionReport(publicId);
        byte[] pdf = pdfGenerator.generate(report);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"report-" + publicId + ".pdf\"")
                .body(pdf);
    }

    @GetMapping("/executions/{publicId}/export/excel")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    public ResponseEntity<byte[]> exportExcel(@PathVariable UUID publicId) {
        ExecutionReportDto report = reportService.buildExecutionReport(publicId);
        byte[] xlsx = excelGenerator.generate(report);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"report-" + publicId + ".xlsx\"")
                .body(xlsx);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    public ResponseEntity<ApiResponse<Page<ReportListItemDto>>> listReports(
            ReportFilterDto filter,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.listReports(filter, pageable)));
    }

    @GetMapping("/scenarios/{publicId}/summary")
    @PreAuthorize("hasAnyRole('TESTER','ADMIN')")
    public ResponseEntity<ApiResponse<ScenarioSummaryDto>> getScenarioSummary(
            @PathVariable UUID publicId) {
        return ResponseEntity.ok(ApiResponse.ok(reportService.buildScenarioSummary(publicId)));
    }
}