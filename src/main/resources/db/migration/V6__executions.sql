-- ============================================================
-- Executions - Senaryo calistirma kayitlari
-- ============================================================

CREATE TABLE executions (
                            id              BIGSERIAL PRIMARY KEY,
                            public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                            scenario_id     BIGINT       NOT NULL REFERENCES scenarios(id) ON DELETE RESTRICT,
                            triggered_by    BIGINT       REFERENCES users(id) ON DELETE SET NULL,
                            triggered_by_name VARCHAR(64) NOT NULL,
                            trigger_type    VARCHAR(32)  NOT NULL DEFAULT 'MANUAL',  -- MANUAL, SCHEDULED, API
                            status          VARCHAR(32)  NOT NULL DEFAULT 'QUEUED',
                            queued_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
                            started_at      TIMESTAMPTZ,
                            finished_at     TIMESTAMPTZ,
                            duration_ms     BIGINT,
                            total_steps     INT,
                            passed_steps    INT          NOT NULL DEFAULT 0,
                            failed_steps    INT          NOT NULL DEFAULT 0,
                            skipped_steps   INT          NOT NULL DEFAULT 0,
                            error_message   TEXT,
                            cancelled_by    VARCHAR(64),
    -- Auditing
                            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                            updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_exec_scenario       ON executions(scenario_id);
CREATE INDEX idx_exec_triggered_by   ON executions(triggered_by);
CREATE INDEX idx_exec_status_active  ON executions(status) WHERE status IN ('QUEUED', 'RUNNING');
CREATE INDEX idx_exec_queued_at_desc ON executions(queued_at DESC);

ALTER TABLE executions ADD CONSTRAINT chk_exec_status
    CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'));

ALTER TABLE executions ADD CONSTRAINT chk_exec_trigger
    CHECK (trigger_type IN ('MANUAL', 'SCHEDULED', 'API'));

COMMENT ON TABLE executions IS 'Senaryo calistirma kayitlari; queue + run + sonuc';
COMMENT ON COLUMN executions.duration_ms IS 'Calistirma suresi ms; finished_at - started_at';

-- ============================================================
-- Execution Step Results - Her adimin sonucu
-- ============================================================

CREATE TABLE execution_step_results (
                                        id              BIGSERIAL PRIMARY KEY,
                                        execution_id    BIGINT       NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
                                        test_step_id    BIGINT       REFERENCES test_steps(id) ON DELETE SET NULL,
                                        step_order      DOUBLE PRECISION NOT NULL,
                                        action_type     VARCHAR(48)  NOT NULL,
                                        description     VARCHAR(500),
                                        status          VARCHAR(32)  NOT NULL,
                                        started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                                        finished_at     TIMESTAMPTZ,
                                        duration_ms     BIGINT,
                                        error_message   TEXT,
                                        screenshot_path VARCHAR(512)
);

CREATE INDEX idx_step_result_exec ON execution_step_results(execution_id);
CREATE INDEX idx_step_result_status ON execution_step_results(status);

ALTER TABLE execution_step_results ADD CONSTRAINT chk_step_result_status
    CHECK (status IN ('PASSED', 'FAILED', 'SKIPPED', 'RUNNING'));

COMMENT ON TABLE execution_step_results IS 'Her step in calistirma sonucu; report icin temel veri';

-- ============================================================
-- Execution Logs - Canlı log satirlari (SSE icin)
-- ============================================================

CREATE TABLE execution_logs (
                                id              BIGSERIAL PRIMARY KEY,
                                execution_id    BIGINT       NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
                                step_result_id  BIGINT       REFERENCES execution_step_results(id) ON DELETE SET NULL,
                                log_level       VARCHAR(16)  NOT NULL,
                                message         TEXT         NOT NULL,
                                occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_exec_time ON execution_logs(execution_id, occurred_at);

ALTER TABLE execution_logs ADD CONSTRAINT chk_log_level
    CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR'));

COMMENT ON TABLE execution_logs IS 'Canli execution log satirlari; SSE ile frontend e stream edilir';