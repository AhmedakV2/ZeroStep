// src/main/java/com/ahmedv2/zerostep/report/service/PdfReportGenerator.java
package com.ahmedv2.zerostep.report.service;

import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.pdf.*;
import com.ahmedv2.zerostep.report.dto.ExecutionReportDto;
import com.ahmedv2.zerostep.report.dto.StepResultReportDto;
import com.ahmedv2.zerostep.step.entity.ActionType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
// java.util.List açıkça import — com.lowagie.text.List ile çakışmayı önler
import java.util.List;

@Component
@RequiredArgsConstructor
public class PdfReportGenerator {

    private static final DateTimeFormatter FMT =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZoneId.systemDefault());

    public byte[] generate(ExecutionReportDto report) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 36, 36, 54, 54);

        try {
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            writer.setPageEvent(new FooterEvent());
            doc.open();

            addHeader(doc, report);
            addScenarioInfo(doc, report);
            addExecutionSummary(doc, report);
            addStepResultsTable(doc, report);
            addFailedStepsDetail(doc, report);

        } catch (Exception e) {
            throw new RuntimeException("PDF uretimi basarisiz", e);
        } finally {
            doc.close();
        }

        return out.toByteArray();
    }

    private void addHeader(Document doc, ExecutionReportDto r) throws Exception {
        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, Color.DARK_GRAY);
        Paragraph title = new Paragraph("ZeroStep - Test Raporu", titleFont);
        title.setAlignment(Element.ALIGN_CENTER);
        title.setSpacingAfter(12);
        doc.add(title);

        Font subFont = FontFactory.getFont(FontFactory.HELVETICA, 10, Color.GRAY);
        Paragraph sub = new Paragraph("Olusturulma: " + FMT.format(java.time.Instant.now()), subFont);
        sub.setAlignment(Element.ALIGN_CENTER);
        sub.setSpacingAfter(20);
        doc.add(sub);
    }

    private void addScenarioInfo(Document doc, ExecutionReportDto r) throws Exception {
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY);
        doc.add(new Paragraph("Senaryo Bilgileri", sectionFont));
        doc.add(Chunk.NEWLINE);

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{1f, 2f});

        addRow(table, "Senaryo Adi", r.scenarioName());
        addRow(table, "Sahip", r.ownerUsername());
        addRow(table, "Execution ID", r.executionPublicId());
        addRow(table, "Tetikleyici", r.triggerType());
        table.setSpacingAfter(16);
        doc.add(table);
    }

    private void addExecutionSummary(Document doc, ExecutionReportDto r) throws Exception {
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY);
        doc.add(new Paragraph("Calistirma Ozeti", sectionFont));
        doc.add(Chunk.NEWLINE);

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{1f, 2f});

        addRow(table, "Durum", r.status());
        addRow(table, "Baslangic", r.startedAt() != null ? FMT.format(r.startedAt()) : "-");
        addRow(table, "Bitis",     r.finishedAt() != null ? FMT.format(r.finishedAt()) : "-");
        addRow(table, "Sure (ms)", String.valueOf(r.metrics().totalDurationMs()));
        addRow(table, "Toplam Step", String.valueOf(r.totalSteps()));
        addRow(table, "Gecti",  String.valueOf(r.passedSteps()));
        addRow(table, "Kaldi",  String.valueOf(r.failedSteps()));
        addRow(table, "Atlandi", String.valueOf(r.skippedSteps()));
        addRow(table, "Basari Orani", String.format("%.1f%%", r.metrics().passRate()));
        table.setSpacingAfter(16);
        doc.add(table);
    }

    private void addStepResultsTable(Document doc, ExecutionReportDto r) throws Exception {
        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.DARK_GRAY);
        doc.add(new Paragraph("Step Sonuclari", sectionFont));
        doc.add(Chunk.NEWLINE);

        PdfPTable table = new PdfPTable(5);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{0.5f, 2f, 2f, 1f, 1f});

        String[] headers = {"#", "Aksiyon", "Aciklama", "Durum", "Sure(ms)"};
        Font hFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, hFont));
            cell.setBackgroundColor(new Color(60, 90, 130));
            cell.setPadding(5);
            table.addCell(cell);
        }

        Font cellFont = FontFactory.getFont(FontFactory.HELVETICA, 8);
        for (StepResultReportDto step : r.stepResults()) {
            Color rowBg = "FAILED".equals(step.status())
                    ? new Color(255, 230, 230) : Color.WHITE;

            addStepCell(table, String.valueOf(step.stepOrder()), cellFont, rowBg);
            // ActionType enum .name() ile stringe çevrilir
            addStepCell(table, step.actionType() != null ? step.actionType().name() : "-", cellFont, rowBg);
            addStepCell(table, nvl(step.description()), cellFont, rowBg);
            addStepCell(table, step.status(), cellFont, rowBg);
            addStepCell(table, step.durationMs() != null ? step.durationMs().toString() : "-", cellFont, rowBg);
        }

        table.setSpacingAfter(16);
        doc.add(table);
    }

    private void addFailedStepsDetail(Document doc, ExecutionReportDto r) throws Exception {
        // java.util.List — explicit tip kullanımı, OpenPDF List ile karışmaz
        List<StepResultReportDto> failed = r.metrics().failedSteps();
        if (failed == null || failed.isEmpty()) return;

        Font sectionFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.RED.darker());
        doc.add(new Paragraph("Hata Detaylari", sectionFont));
        doc.add(Chunk.NEWLINE);

        Font errFont = FontFactory.getFont(FontFactory.COURIER, 8, Color.DARK_GRAY);
        for (StepResultReportDto s : failed) {
            doc.add(new Paragraph(
                    "Step #" + s.stepOrder() + " - " +
                            (s.actionType() != null ? s.actionType().name() : "-"),
                    FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9)));
            if (s.errorMessage() != null) {
                String err = s.errorMessage().length() > 500
                        ? s.errorMessage().substring(0, 500) + "..." : s.errorMessage();
                doc.add(new Paragraph(err, errFont));
            }
            doc.add(Chunk.NEWLINE);
        }
    }

    private void addRow(PdfPTable table, String key, String value) {
        Font keyFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);
        Font valFont = FontFactory.getFont(FontFactory.HELVETICA, 9);
        PdfPCell k = new PdfPCell(new Phrase(key, keyFont));
        PdfPCell v = new PdfPCell(new Phrase(nvl(value), valFont));
        k.setPadding(4);
        v.setPadding(4);
        k.setBackgroundColor(new Color(240, 240, 240));
        table.addCell(k);
        table.addCell(v);
    }

    private void addStepCell(PdfPTable table, String text, Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(nvl(text), font));
        cell.setBackgroundColor(bg);
        cell.setPadding(4);
        table.addCell(cell);
    }

    private String nvl(String s) { return s != null ? s : "-"; }

    // Sayfa footer'ı — sayfa numarası ve tarih
    private static class FooterEvent extends PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            Font f = FontFactory.getFont(FontFactory.HELVETICA, 7, Color.GRAY);
            Phrase footer = new Phrase("ZeroStep | Sayfa " + writer.getPageNumber(), f);
            ColumnText.showTextAligned(cb, Element.ALIGN_CENTER, footer,
                    (document.right() + document.left()) / 2,
                    document.bottom() - 10, 0);
        }
    }
}