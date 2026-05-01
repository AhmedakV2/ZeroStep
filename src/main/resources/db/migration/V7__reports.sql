-- src/main/resources/db/migration/V7__reports.sql

-- Rapor tablosu gerekmez; raporlar execution verisinden anlık üretilir.
-- Sadece indeks optimizasyonu ekliyoruz.

CREATE INDEX IF NOT EXISTS idx_exec_user_status
    ON executions(triggered_by, status);

CREATE INDEX IF NOT EXISTS idx_exec_scenario_finished
    ON executions(scenario_id, finished_at DESC);

COMMENT ON INDEX idx_exec_user_status IS 'Rapor filtreleme sorgularini hizlandirir';