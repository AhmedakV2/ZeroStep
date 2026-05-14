-- Add audit columns to scenario_groups to match BaseEntity
ALTER TABLE scenario_groups
    ADD COLUMN created_by VARCHAR(64),
    ADD COLUMN updated_by VARCHAR(64);

-- Ensure updated_at exists and remains nullable for existing rows
ALTER TABLE scenario_groups
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

