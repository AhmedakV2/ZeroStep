-- ============================================================
-- FAZ 8: Notifications + NotificationPreferences
-- ============================================================

CREATE TABLE notifications (
                               id              BIGSERIAL PRIMARY KEY,
                               public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                               recipient_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               type            VARCHAR(64)  NOT NULL,
                               title           VARCHAR(255) NOT NULL,
                               message         TEXT         NOT NULL,
                               link            VARCHAR(1024),
                               is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
                               read_at         TIMESTAMPTZ,
                               created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_recipient_unread ON notifications(recipient_id, is_read)
    WHERE is_read = FALSE;
CREATE INDEX idx_notif_recipient_time   ON notifications(recipient_id, created_at DESC);

ALTER TABLE notifications ADD CONSTRAINT chk_notif_type
    CHECK (type IN (
                    'EXECUTION_COMPLETED', 'EXECUTION_FAILED', 'SCENARIO_SHARED',
                    'ADMIN_ANNOUNCEMENT', 'NEW_MESSAGE', 'SCHEDULE_TRIGGERED'
        ));

-- ============================================================
-- Bildirim tercihleri (her kullanici x her tip icin)
-- ============================================================

CREATE TABLE notification_preferences (
                                          id          BIGSERIAL PRIMARY KEY,
                                          user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                          type        VARCHAR(64) NOT NULL,
                                          enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
                                          channels    TEXT[]      NOT NULL DEFAULT '{IN_APP}',
                                          UNIQUE (user_id, type)
);

CREATE INDEX idx_notif_pref_user ON notification_preferences(user_id);

ALTER TABLE notification_preferences ADD CONSTRAINT chk_pref_type
    CHECK (type IN (
                    'EXECUTION_COMPLETED', 'EXECUTION_FAILED', 'SCENARIO_SHARED',
                    'ADMIN_ANNOUNCEMENT', 'NEW_MESSAGE', 'SCHEDULE_TRIGGERED'
        ));

COMMENT ON TABLE notification_preferences IS 'Kullanici bazi bildirim kanal tercihleri';
COMMENT ON COLUMN notification_preferences.channels IS 'IN_APP ve/veya EMAIL';