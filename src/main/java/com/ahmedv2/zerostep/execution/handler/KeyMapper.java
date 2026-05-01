package com.ahmedv2.zerostep.execution.handler;

import org.openqa.selenium.Keys;

import java.util.Map;

// "ENTER" -> Keys.ENTER, "CTRL+A" -> [Keys.CONTROL, "a"]
public final class KeyMapper {

    private static final Map<String, Keys> KEY_MAP = Map.<String, Keys>ofEntries(
            Map.entry("ENTER", Keys.ENTER),
            Map.entry("RETURN", Keys.RETURN),
            Map.entry("TAB", Keys.TAB),
            Map.entry("ESCAPE", Keys.ESCAPE),
            Map.entry("ESC", Keys.ESCAPE),
            Map.entry("BACKSPACE", Keys.BACK_SPACE),
            Map.entry("DELETE", Keys.DELETE),
            Map.entry("SPACE", Keys.SPACE),
            Map.entry("ARROW_UP", Keys.ARROW_UP),
            Map.entry("ARROW_DOWN", Keys.ARROW_DOWN),
            Map.entry("ARROW_LEFT", Keys.ARROW_LEFT),
            Map.entry("ARROW_RIGHT", Keys.ARROW_RIGHT),
            Map.entry("HOME", Keys.HOME),
            Map.entry("END", Keys.END),
            Map.entry("PAGE_UP", Keys.PAGE_UP),
            Map.entry("PAGE_DOWN", Keys.PAGE_DOWN),
            Map.entry("F1", Keys.F1),
            Map.entry("F2", Keys.F2),
            Map.entry("F3", Keys.F3),
            Map.entry("F4", Keys.F4),
            Map.entry("F5", Keys.F5),
            Map.entry("F6", Keys.F6),
            Map.entry("F7", Keys.F7),
            Map.entry("F8", Keys.F8),
            Map.entry("F9", Keys.F9),
            Map.entry("F10", Keys.F10),
            Map.entry("F11", Keys.F11),
            Map.entry("F12", Keys.F12),
            Map.entry("CTRL", Keys.CONTROL),
            Map.entry("CONTROL", Keys.CONTROL),
            Map.entry("SHIFT", Keys.SHIFT),
            Map.entry("ALT", Keys.ALT),
            Map.entry("META", Keys.META),
            Map.entry("CMD", Keys.COMMAND),
            Map.entry("COMMAND", Keys.COMMAND)
    );

    private KeyMapper() {}

    // Tek tus; "ENTER" gibi
    public static CharSequence single(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Tus ismi bos olamaz");
        }
        Keys k = KEY_MAP.get(name.trim().toUpperCase());
        if (k == null) {
            throw new IllegalArgumentException("Tanimsiz tus: " + name);
        }
        return k;
    }

    // Combo "CTRL+A", "SHIFT+TAB" -> CharSequence[] (Keys.chord ile birlestirilir)
    public static CharSequence chord(String combo) {
        if (combo == null || combo.isBlank()) {
            throw new IllegalArgumentException("Tus kombinasyonu bos olamaz");
        }
        String[] parts = combo.split("\\+");
        CharSequence[] keys = new CharSequence[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i].trim();
            Keys mapped = KEY_MAP.get(p.toUpperCase());
            if (mapped != null) {
                keys[i] = mapped;
            } else if (p.length() == 1) {
                // Tek karakter, harf/rakam: direkt string
                keys[i] = p.toLowerCase();
            } else {
                throw new IllegalArgumentException("Tanimsiz tus: " + p);
            }
        }
        return Keys.chord(keys);
    }
}