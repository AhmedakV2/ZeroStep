package com.ahmedv2.zerostep.report.service;

import com.ahmedv2.zerostep.report.dto.ExecutionReportDto;
import com.ahmedv2.zerostep.report.dto.StepResultReportDto;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Component
@RequiredArgsConstructor
public class ExcelReportGenerator {

    private static final DateTimeFormatter FMT =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZoneId.systemDefault());

    // 3 sheet'li XLSX dosyasını belleğe yazar ve byte array olarak döner
    public byte[] generate(ExecutionReportDto report) {
        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            buildSummarySheet(wb, report);
            buildStepsSheet(wb, report);
            buildLogsPlaceholderSheet(wb, report);

            wb.write(out);
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Excel uretimi basarisiz", e);
        }
    }

    private void buildSummarySheet(XSSFWorkbook wb, ExecutionReportDto r) {
        Sheet sheet = wb.createSheet("Summary");
        CellStyle headerStyle = boldStyle(wb);

        // KPI satırlarını key-value çiftleri olarak yazar
        String[][] rows = {
                {"Senaryo Adi", r.scenarioName()},
                {"Sahip", r.ownerUsername()},
                {"Execution ID", r.executionPublicId()},
                {"Durum", r.status()},
                {"Tetikleyici", r.triggerType()},
                {"Baslangic", r.startedAt() != null ? FMT.format(r.startedAt()) : "-"},
                {"Bitis", r.finishedAt() != null ? FMT.format(r.finishedAt()) : "-"},
                {"Sure (ms)", String.valueOf(r.metrics().totalDurationMs())},
                {"Toplam Step", String.valueOf(r.totalSteps())},
                {"Gecti", String.valueOf(r.passedSteps())},
                {"Kaldi", String.valueOf(r.failedSteps())},
                {"Atlandi", String.valueOf(r.skippedSteps())},
                {"Basari Orani", String.format("%.1f%%", r.metrics().passRate())},
                {"Ort. Step Suresi (ms)", String.format("%.1f", r.metrics().avgStepDurationMs())},
                {"Ekran Goruntüsü Sayisi", String.valueOf(r.metrics().screenshotCount())},
        };

        for (int i = 0; i < rows.length; i++) {
            Row row = sheet.createRow(i);
            Cell keyCell = row.createCell(0);
            keyCell.setCellValue(rows[i][0]);
            keyCell.setCellStyle(headerStyle);
            row.createCell(1).setCellValue(rows[i][1]);
        }

        sheet.autoSizeColumn(0);
        sheet.autoSizeColumn(1);
    }

    private void buildStepsSheet(XSSFWorkbook wb, ExecutionReportDto r) {
        Sheet sheet = wb.createSheet("Steps");
        CellStyle headerStyle = boldStyle(wb);

        // Başlık satırı
        String[] headers = {"#", "Aksiyon", "Aciklama", "Durum", "Sure(ms)", "Hata", "Screenshot"};
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell c = headerRow.createCell(i);
            c.setCellValue(headers[i]);
            c.setCellStyle(headerStyle);
        }

        int rowNum = 1;
        for (StepResultReportDto s : r.stepResults()) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(s.stepOrder());
            row.createCell(1).setCellValue(s.actionType() != null ? s.actionType().name() : "-");
            row.createCell(2).setCellValue(nvl(s.description()));
            row.createCell(3).setCellValue(s.status());
            row.createCell(4).setCellValue(s.durationMs() != null ? s.durationMs() : 0L);
            row.createCell(5).setCellValue(nvl(s.errorMessage()));
            row.createCell(6).setCellValue(s.screenshotPath() != null ? "VAR" : "-");
        }

        for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);
    }

    private void buildLogsPlaceholderSheet(XSSFWorkbook wb, ExecutionReportDto r) {
        // Log satırları ayrı servis çağrısı gerektirdiğinden placeholder bilgi yazar
        Sheet sheet = wb.createSheet("Logs");
        Row info = sheet.createRow(0);
        info.createCell(0).setCellValue(
                "Detayli loglar icin: GET /api/v1/executions/" + r.executionPublicId() + "/logs");
    }

    private CellStyle boldStyle(XSSFWorkbook wb) {
        CellStyle style = wb.createCellStyle();
        org.apache.poi.ss.usermodel.Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private String nvl(String s) {
        return s != null ? s : "";
    }
}