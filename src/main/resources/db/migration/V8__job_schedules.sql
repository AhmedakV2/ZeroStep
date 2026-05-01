-- Faz 7: Periyodik çalıştırma için schedule tablosu
CREATE TABLE job_schedules (
                               id              BIGSERIAL PRIMARY KEY,
                               public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                               scenario_id     BIGINT       NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
                               created_by      BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               frequency       VARCHAR(16)  NOT NULL,   -- HOURLY, DAILY, WEEKLY
                               run_time        VARCHAR(5),              -- HH:mm formatında (DAILY/WEEKLY için)
                               run_day_of_week SMALLINT,               -- 1=Pazartesi 7=Pazar (WEEKLY için)
                               timezone        VARCHAR(64)  NOT NULL DEFAULT 'Europe/Istanbul',
                               enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
                               last_run_at     TIMESTAMPTZ,
                               next_run_at     TIMESTAMPTZ,
                               recipients      TEXT[]       NOT NULL DEFAULT '{}',  -- e-posta listesi
                               notify_on_failure_only BOOLEAN NOT NULL DEFAULT FALSE,
                               created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                               updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedules_scenario    ON job_schedules(scenario_id);
CREATE INDEX idx_schedules_next_run    ON job_schedules(next_run_at) WHERE enabled = TRUE;
CREATE INDEX idx_schedules_created_by  ON job_schedules(created_by);

ALTER TABLE job_schedules ADD CONSTRAINT chk_schedule_frequency
    CHECK (frequency IN ('HOURLY', 'DAILY', 'WEEKLY'));

ALTER TABLE job_schedules ADD CONSTRAINT chk_schedule_day_of_week
    CHECK (run_day_of_week IS NULL OR (run_day_of_week BETWEEN 1 AND 7));

COMMENT ON COLUMN job_schedules.run_time IS 'HH:mm formatında; HOURLY için NULL';
COMMENT ON COLUMN job_schedules.run_day_of_week IS '1=Pazartesi, 7=Pazar; sadece WEEKLY';
COMMENT ON COLUMN job_schedules.notify_on_failure_only IS 'TRUE ise sadece FAILED execution da mail gönderir';