-- ============================================================
-- Audit Events - Admin islemlerinin denetim kaydi
-- Append-only; hic UPDATE yapilmaz
-- ============================================================
CREATE TABLE audit_events (
                              id          BIGSERIAL PRIMARY KEY,
                              actor_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
                              actor_name  VARCHAR(64)  NOT NULL,           -- actor_id null olsa bile kim yaptigi kalir
                              event_type  VARCHAR(64)  NOT NULL,           -- USER_CREATED, USER_DISABLED, ROLE_CHANGED...
                              entity_type VARCHAR(64),                      -- USER, ROLE, SCENARIO...
                              entity_id   BIGINT,
                              payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
                              ip_address  VARCHAR(45),
                              user_agent  VARCHAR(255),
                              occurred_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_time  ON audit_events(occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_events(actor_id);
CREATE INDEX idx_audit_type  ON audit_events(event_type);

COMMENT ON TABLE audit_events IS 'Kritik islemlerin append-only denetim kaydi; compliance + forensic';
COMMENT ON COLUMN audit_events.payload IS 'Islemin detayi; diff, eski deger, yeni deger vb.';