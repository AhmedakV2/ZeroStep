package com.ahmedv2.zerostep.admin.dto;

import lombok.Data;
import java.time.Instant;
import java.util.Map;

@Data
public class AdminAuditResponse {
    private Instant timestamp;
    private String username;
    private String action;
    private String resourceName;
    private String ipAddress;
    private String status;
    private Map<String, Object> details;
}