package com.ahmedv2.zerostep.mail.service;

import com.ahmedv2.zerostep.config.properties.AppProperties;
import com.ahmedv2.zerostep.execution.entity.Execution;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

// app.mail.provider=smtp (dev için Gmail)
@Service
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "smtp", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class SmtpMailService implements MailService {

    private static final DateTimeFormatter FMT =
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss").withZone(ZoneId.systemDefault());

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final AppProperties appProperties;

    @Override
    public void sendExecutionResult(Execution execution, List<String> recipients) {
        if (!appProperties.getMail().isEnabled()) {
            log.debug("Mail devre dışı; execution result maili atlanıyor: {}", execution.getId());
            return;
        }
        try {
            Context ctx = new Context();
            ctx.setVariable("scenarioName", execution.getScenario().getName());
            ctx.setVariable("status", execution.getStatus().name());
            ctx.setVariable("triggeredBy", execution.getTriggeredByName());
            ctx.setVariable("startedAt", execution.getStartedAt() != null
                    ? FMT.format(execution.getStartedAt()) : "-");
            ctx.setVariable("finishedAt", execution.getFinishedAt() != null
                    ? FMT.format(execution.getFinishedAt()) : "-");
            ctx.setVariable("durationMs", execution.getDurationMs());
            ctx.setVariable("totalSteps", execution.getTotalSteps());
            ctx.setVariable("passedSteps", execution.getPassedSteps());
            ctx.setVariable("failedSteps", execution.getFailedSteps());
            ctx.setVariable("executionPublicId", execution.getPublicId().toString());

            String body = templateEngine.process("mail/execution-result", ctx);
            String subject = "[ZeroStep] " + execution.getStatus().name() + " - "
                    + execution.getScenario().getName();

            send(recipients, subject, body);
        } catch (Exception e) {
            log.error("Execution result maili gönderilemedi: executionId={}", execution.getId(), e);
        }
    }

    @Override
    public void sendWelcome(String toEmail, String username, String temporaryPassword) {
        if (!appProperties.getMail().isEnabled()) {
            log.debug("Mail devre dışı; hoşgeldin maili atlanıyor: {}", username);
            return;
        }
        try {
            Context ctx = new Context();
            ctx.setVariable("username", username);
            ctx.setVariable("temporaryPassword", temporaryPassword);

            String body = templateEngine.process("mail/welcome", ctx);
            send(List.of(toEmail), "[ZeroStep] Hesabınız Oluşturuldu", body);
        } catch (Exception e) {
            log.error("Welcome maili gönderilemedi: {}", toEmail, e);
        }
    }

    private void send(List<String> recipients, String subject, String htmlBody) throws Exception {
        MimeMessage msg = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(msg, true, "UTF-8");
        helper.setFrom(appProperties.getMail().getFromAddress(),
                appProperties.getMail().getFromName());
        helper.setTo(recipients.toArray(new String[0]));
        helper.setSubject(subject);
        helper.setText(htmlBody, true);
        mailSender.send(msg);
        log.info("Mail gönderildi: to={} subject={}", recipients, subject);
    }
}