-- src/main/resources/db/migration/V10__chat.sql

CREATE TABLE conversations (
                               id              BIGSERIAL PRIMARY KEY,
                               public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    -- Çift yönlü unique sağlamak için user_one_id < user_two_id invariant'ı tutulur
                               user_one_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               user_two_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               last_message_at TIMESTAMPTZ,
                               last_message_preview VARCHAR(255),
                               created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                               CONSTRAINT chk_conv_different_users CHECK (user_one_id <> user_two_id),
                               CONSTRAINT uq_conversation UNIQUE (user_one_id, user_two_id)
);

-- Kullanıcının konuşmalarını bulmak için iki yönlü index
CREATE INDEX idx_conv_user_one ON conversations(user_one_id);
CREATE INDEX idx_conv_user_two ON conversations(user_two_id);
CREATE INDEX idx_conv_last_msg ON conversations(last_message_at DESC NULLS LAST);

CREATE TABLE messages (
                          id              BIGSERIAL PRIMARY KEY,
                          public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                          conversation_id BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                          sender_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                          content         TEXT         NOT NULL,
                          sent_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
                          delivered_at    TIMESTAMPTZ,
                          read_at         TIMESTAMPTZ,
                          is_deleted      BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_msg_conv_sent ON messages(conversation_id, sent_at ASC);
CREATE INDEX idx_msg_sender    ON messages(sender_id);

COMMENT ON COLUMN messages.is_deleted IS 'Soft delete; admin içeriği yine görebilir';
COMMENT ON CONSTRAINT uq_conversation ON conversations IS
    'user_one_id daima küçük ID olacak şekilde servis tarafında normalize edilir';