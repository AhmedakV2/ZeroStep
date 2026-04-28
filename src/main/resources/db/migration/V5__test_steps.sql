-- ============================================================
-- Test Steps - Senaryolarin atomik adimlari
-- step_order DOUBLE PRECISION ile fractional indexing
-- 50 action type, 8 selector type
-- ============================================================

CREATE TABLE test_steps (
                            id              BIGSERIAL PRIMARY KEY,
                            public_id       UUID            NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                            scenario_id     BIGINT          NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
                            step_order      DOUBLE PRECISION NOT NULL,
                            action_type     VARCHAR(48)     NOT NULL,
                            selector_type   VARCHAR(32),
                            selector_value  VARCHAR(2048),
                            input_value     TEXT,
                            secondary_value TEXT,
                            description     VARCHAR(500),
                            config          JSONB           NOT NULL DEFAULT '{}'::jsonb,
                            enabled         BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Auditing
                            created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
                            updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
                            created_by      VARCHAR(64),
                            updated_by      VARCHAR(64),
                            deleted_at      TIMESTAMPTZ
);

-- Sirali listeleme; en sik kullanilan sorgu
CREATE INDEX idx_steps_scenario_order ON test_steps(scenario_id, step_order)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_steps_action_type ON test_steps(action_type)
    WHERE deleted_at IS NULL;

-- Action type CHECK; gecersiz tip DB seviyesinde reddedilir
ALTER TABLE test_steps ADD CONSTRAINT chk_steps_action_type
    CHECK (action_type IN (
        -- Navigation
                           'NAVIGATE', 'NAVIGATE_BACK', 'NAVIGATE_FORWARD', 'REFRESH',
        -- Mouse
                           'CLICK', 'DOUBLE_CLICK', 'RIGHT_CLICK', 'MIDDLE_CLICK',
                           'HOVER', 'DRAG_AND_DROP', 'CLICK_AT_OFFSET',
        -- Keyboard / Input
                           'TYPE', 'TYPE_SECRET', 'CLEAR', 'SELECT_OPTION',
                           'PRESS_KEY', 'PRESS_KEY_COMBO', 'UPLOAD_FILE', 'FOCUS', 'BLUR',
        -- Scrolling
                           'SCROLL_TO_ELEMENT', 'SCROLL_TO_TOP', 'SCROLL_TO_BOTTOM', 'SCROLL_BY_PIXELS',
        -- Waits
                           'WAIT_SECONDS', 'WAIT_FOR_VISIBLE', 'WAIT_FOR_INVISIBLE',
                           'WAIT_FOR_CLICKABLE', 'WAIT_FOR_TEXT', 'WAIT_FOR_URL',
        -- Assertions
                           'ASSERT_VISIBLE', 'ASSERT_NOT_VISIBLE',
                           'ASSERT_TEXT_EQUALS', 'ASSERT_TEXT_CONTAINS', 'ASSERT_TEXT_MATCHES_REGEX',
                           'ASSERT_URL_EQUALS', 'ASSERT_URL_CONTAINS',
                           'ASSERT_TITLE_CONTAINS', 'ASSERT_ATTRIBUTE_EQUALS',
                           'ASSERT_ELEMENT_COUNT', 'ASSERT_ENABLED', 'ASSERT_DISABLED',
        -- Frames / Tabs
                           'SWITCH_FRAME', 'SWITCH_TO_PARENT_FRAME', 'SWITCH_TO_DEFAULT_CONTENT',
                           'SWITCH_TAB', 'OPEN_NEW_TAB', 'CLOSE_TAB',
        -- Storage / Cookies
                           'SET_COOKIE', 'DELETE_COOKIE', 'CLEAR_COOKIES',
                           'SET_LOCAL_STORAGE', 'CLEAR_LOCAL_STORAGE',
        -- Misc
                           'SCREENSHOT', 'EXECUTE_SCRIPT', 'LOG_MESSAGE', 'SLEEP_RANDOM'
        ));

ALTER TABLE test_steps ADD CONSTRAINT chk_steps_selector_type
    CHECK (selector_type IS NULL OR selector_type IN (
                                                      'CSS', 'XPATH', 'ID', 'NAME', 'CLASS_NAME', 'TAG_NAME',
                                                      'LINK_TEXT', 'PARTIAL_LINK_TEXT'
        ));

COMMENT ON TABLE test_steps IS 'Senaryo adimlari; step_order fractional indexing ile O(1) reorder';
COMMENT ON COLUMN test_steps.step_order IS 'Fractional index; iki adim arasina yeni adim ortalama ile eklenir';
COMMENT ON COLUMN test_steps.input_value IS 'Birincil deger: yazilacak metin, URL, key, beklenecek deger';
COMMENT ON COLUMN test_steps.secondary_value IS 'Ikincil deger: DRAG_AND_DROP target selector, SET_COOKIE value, ASSERT_ATTRIBUTE_EQUALS attr name vb';
COMMENT ON COLUMN test_steps.config IS 'Action-specific config: timeout, retry, screenshotOnFail, expectedText vb';