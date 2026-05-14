-- Yeni Scenario Groups tablosunu oluşturma
CREATE TABLE scenario_groups (
                                 id BIGSERIAL PRIMARY KEY,
                                 public_id UUID NOT NULL UNIQUE,
                                 owner_id BIGINT NOT NULL REFERENCES users(id),
                                 name VARCHAR(255) NOT NULL,
                                 description TEXT,
                                 deleted_at TIMESTAMP,
                                 created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                                 updated_at TIMESTAMP
);

-- Mevcut scenarios tablosuna group_id kolonunu ekleme
ALTER TABLE scenarios
    ADD COLUMN group_id BIGINT REFERENCES scenario_groups(id) ON DELETE SET NULL;