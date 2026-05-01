package com.ahmedv2.zerostep.mail.service;

import com.ahmedv2.zerostep.execution.entity.Execution;

import java.util.List;

// Mail gönderim interface'i; provider bağımsız (SMTP veya corporate)
public interface MailService {

    void sendExecutionResult(Execution execution, List<String> recipients);

    void sendWelcome(String toEmail, String username, String temporaryPassword);
}