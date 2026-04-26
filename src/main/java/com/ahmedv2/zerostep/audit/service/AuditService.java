package com.ahmedv2.zerostep.audit.service;


import com.ahmedv2.zerostep.audit.entity.AuditEvent;
import com.ahmedv2.zerostep.audit.repository.AuditEventRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {
    private final AuditEventRepository auditEventRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String eventType, String entityType, Long entityId, Map<String,Object> payload){
        try{
            AuditEvent event = new AuditEvent();
            event.setEventType(eventType);
            event.setEntityType(entityType);
            event.setEntityId(entityId);
            event.setPayload(payload != null ? payload : Map.of());
            event.setActorName(currentActor());
            fillRequestContext(event);

            auditEventRepository.save(event);
            log.debug("Audit kaydedildi: {} entity={}:{}",eventType,entityType,entityId);
        }catch (Exception e){
            log.error("Audit yazilamadi: eventType={}, entity{}:{}",
                    eventType,entityType,entityId,e);
        }
    }
    private String currentActor(){
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if(auth != null && !"anonymousUser".equals(auth.getPrincipal())){
           return auth.getName();
        }
        return "system";
    }

    private void fillRequestContext(AuditEvent event){
        try{
            ServletRequestAttributes attrs=
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if(attrs != null){
                HttpServletRequest req = attrs.getRequest();
                event.setIpAddress(extractIp(req));
                event.setUserAgent(truncate(req.getHeader("User-Agent"),255));
            }
        }catch (Exception ignored){}
    }

    private String extractIp(HttpServletRequest request){
        String xff = request.getHeader("X-Forwarded-For");
        if(xff != null && !xff.isBlank()){
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }


    private String truncate(String s,int maxLength){
        if(s == null) return null;
        return  s.length() > maxLength ? s.substring(0,maxLength) : s;
    }
}
