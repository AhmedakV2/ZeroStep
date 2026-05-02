-- FAZ 11: Chrome Extension API Token tablosu
CREATE TABLE extension_api_tokens (
                                      id              BIGSERIAL PRIMARY KEY,
                                      public_id       UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                                      user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                      name            VARCHAR(128) NOT NULL,
                                      token_hash      VARCHAR(128) NOT NULL UNIQUE, -- SHA-256 hex; plain token sadece oluşturulduğunda gösterilir
                                      last_used_at    TIMESTAMPTZ,
                                      expires_at      TIMESTAMPTZ,                  -- NULL = sonsuz
                                      revoked_at      TIMESTAMPTZ,
                                      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ext_token_user    ON extension_api_tokens(user_id);
CREATE INDEX idx_ext_token_hash    ON extension_api_tokens(token_hash) WHERE revoked_at IS NULL;

COMMENT ON TABLE extension_api_tokens IS 'Chrome Extension için API token; plain token asla saklanmaz';
COMMENT ON COLUMN extension_api_tokens.token_hash IS 'SHA-256 hash; X-AFT-Token header ile gelen değer hash edilerek karşılaştırılır';