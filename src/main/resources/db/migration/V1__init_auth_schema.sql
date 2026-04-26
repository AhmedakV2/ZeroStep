-- ============================================================
-- ZeroStep - Faz 1: Authentication & User Management Schema
-- ============================================================

-- pgcrypto uzantisi UUID icin gerekli
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ROLES - Sistem rolleri
-- ============================================================
CREATE TABLE roles (
                       id          SMALLSERIAL PRIMARY KEY,
                       name        VARCHAR(32)  NOT NULL UNIQUE,
                       description VARCHAR(255),
                       created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE roles IS 'Sistem rolleri: ADMIN, TESTER, VIEWER';

-- ============================================================
-- USERS - Sistem kullanicilari
-- ============================================================
CREATE TABLE users (
                       id                         BIGSERIAL PRIMARY KEY,
                       public_id                  UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
                       username                   VARCHAR(64)  NOT NULL UNIQUE,
                       email                      VARCHAR(255) NOT NULL UNIQUE,
                       password_hash              VARCHAR(255) NOT NULL,
                       display_name               VARCHAR(128),
                       enabled                    BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Ilk giris zorunlu sifre degistirme flag'i; admin ekledigi her yeni kullanicida TRUE
                       password_change_required   BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Brute-force koruma alanlari
                       failed_login_attempts      INT          NOT NULL DEFAULT 0,
                       locked_until               TIMESTAMPTZ,
                       last_login_at              TIMESTAMPTZ,
    -- Auditing
                       created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
                       updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
                       created_by                 VARCHAR(64),
                       updated_by                 VARCHAR(64),
                       deleted_at                 TIMESTAMPTZ
);

-- Soft-deleted kayitlari sorgu maliyetinden dusurmek icin partial index
CREATE UNIQUE INDEX idx_users_username_active ON users(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_email_active    ON users(email)    WHERE deleted_at IS NULL;

COMMENT ON COLUMN users.password_change_required IS 'TRUE ise kullanici bir sonraki girisinde sifresini degistirmek zorunda';
COMMENT ON COLUMN users.locked_until IS 'Brute-force sonrasi bu tarihe kadar giris yasak';

-- ============================================================
-- USER_ROLES - Kullanici <-> Rol cogul iliski
-- ============================================================
CREATE TABLE user_roles (
                            user_id BIGINT   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            role_id SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
                            PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ============================================================
-- REFRESH_TOKENS - Refresh token'larin DB'de hash'li tutulmasi
-- Plain token asla saklanmaz; sadece SHA-256 hash'i tutulur
-- ============================================================
CREATE TABLE refresh_tokens (
                                id          BIGSERIAL PRIMARY KEY,
                                user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                token_hash  VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256 hex string
                                expires_at  TIMESTAMPTZ  NOT NULL,
                                revoked_at  TIMESTAMPTZ,
                                user_agent  VARCHAR(255),
                                ip_address  VARCHAR(45),                     -- IPv6 icin 45 char
                                created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_rt_user_valid ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_rt_expires    ON refresh_tokens(expires_at);

COMMENT ON COLUMN refresh_tokens.token_hash IS 'Token HAM DEGIL, SHA-256 hash. Plain token sadece client elinde.';