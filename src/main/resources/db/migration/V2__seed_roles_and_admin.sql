-- ============================================================
-- Seed: Sistem rolleri + ilk admin kullanicisi
-- ============================================================

INSERT INTO roles (name, description) VALUES
                                          ('ADMIN',  'Tam yetki: kullanici yonetimi, duyurular, tum senaryolar'),
                                          ('TESTER', 'Senaryo olusturma ve calistirma'),
                                          ('VIEWER', 'Sadece okuma; senaryo ve raporlari goruntuler')
    ON CONFLICT (name) DO NOTHING;

-- Ilk admin: username=admin, password=Admin123!
-- BCrypt strength 12 ile hash'lendi. Admin ilk giriste sifresini degistirmek zorunda.
INSERT INTO users (
    username, email, password_hash, display_name,
    enabled, password_change_required, created_by
) VALUES (
             'admin',
             'admin@zerostep.local',
             '$2a$12$jhzIAarwUh4k5KOQL3r0euUfnE5Nz0pKptxbOOSrBHbSGBT1Vj1UC',
             'System Administrator',
             TRUE,
             TRUE,
             'system'
         ) ON CONFLICT (username) DO NOTHING;

-- Admin rolunu kullaniciya ata
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'ADMIN'
    ON CONFLICT DO NOTHING;