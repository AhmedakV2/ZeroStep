-- src/main/resources/db/migration/V11__announcements.sql

CREATE TABLE announcements (
                               id              BIGSERIAL PRIMARY KEY,
                               public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                               title           VARCHAR(255) NOT NULL,
                               body            TEXT         NOT NULL,
                               severity        VARCHAR(16)  NOT NULL DEFAULT 'INFO',
                               target_type     VARCHAR(16)  NOT NULL DEFAULT 'ALL',
                               target_roles    TEXT[]       NOT NULL DEFAULT '{}',
                               target_user_ids BIGINT[]     NOT NULL DEFAULT '{}',
                               is_published    BOOLEAN      NOT NULL DEFAULT FALSE,
                               publish_at      TIMESTAMPTZ,
                               expires_at      TIMESTAMPTZ,
                               created_by      BIGINT       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
                               created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                               updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ann_published    ON announcements(is_published, publish_at);
CREATE INDEX idx_ann_expires      ON announcements(expires_at)    WHERE is_published = TRUE;
CREATE INDEX idx_ann_target_type  ON announcements(target_type)   WHERE is_published = TRUE;

ALTER TABLE announcements ADD CONSTRAINT chk_ann_severity
    CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'));

ALTER TABLE announcements ADD CONSTRAINT chk_ann_target
    CHECK (target_type IN ('ALL', 'ROLE', 'USERS'));

-- Kullanıcıların dismiss ettiği duyurular
CREATE TABLE announcement_dismissals (
                                         announcement_id BIGINT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
                                         user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                         dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
                                         PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX idx_dismissal_user ON announcement_dismissals(user_id);

COMMENT ON TABLE announcements IS 'Admin duyuruları; ALL/ROLE/USERS hedefleme + severity';
COMMENT ON TABLE announcement_dismissals IS 'Kullanıcının kapattığı duyurular; tekrar görünmez';