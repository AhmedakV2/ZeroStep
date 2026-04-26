-- ============================================================
-- Scenarios - Test senaryolari
-- ============================================================

CREATE TABLE scenarios (
                           id              BIGSERIAL PRIMARY KEY,
                           public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                           owner_id        BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                           name            VARCHAR(255) NOT NULL,
                           description     TEXT,
                           status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
                           base_url        VARCHAR(1024),
                           browser_config  JSONB        NOT NULL DEFAULT '{}'::jsonb,
                           tags            TEXT[]       NOT NULL DEFAULT '{}',
    -- Auditing
                           created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                           updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                           created_by      VARCHAR(64),
                           updated_by      VARCHAR(64),
                           deleted_at      TIMESTAMPTZ
);

-- Aktif kayitlar icin partial index; soft-deleted kayitlari maliyetten dusurur
CREATE INDEX idx_scenarios_owner_active  ON scenarios(owner_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_scenarios_status_active ON scenarios(status)    WHERE deleted_at IS NULL;
-- Tag sorgulari icin GIN index; "tag icerir" sorgularinda hizli
CREATE INDEX idx_scenarios_tags_gin ON scenarios USING GIN(tags) WHERE deleted_at IS NULL;

-- Valid status enum check (DB seviyesinde savunma)
ALTER TABLE scenarios ADD CONSTRAINT chk_scenarios_status
    CHECK (status IN ('DRAFT', 'READY', 'ARCHIVED'));

COMMENT ON TABLE scenarios IS 'Test senaryolari; owner izolasyonu + state machine';
COMMENT ON COLUMN scenarios.browser_config IS 'JSONB: headless, keepBrowserOpen, viewport, timeouts';
COMMENT ON COLUMN scenarios.tags IS 'Array of tags; sorgu GIN index uzerinden';