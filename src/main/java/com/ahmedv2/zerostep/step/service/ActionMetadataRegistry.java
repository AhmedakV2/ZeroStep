package com.ahmedv2.zerostep.step.service;

import com.ahmedv2.zerostep.step.dto.ActionMetadataResponse;
import com.ahmedv2.zerostep.step.entity.ActionType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// 50 action icin frontend metadatasi; dinamik form olustururken bunu kullanir
@Component
public class ActionMetadataRegistry {

    // Sirali map; UI'da kategori bazinda gosterim
    private final Map<ActionType, Meta> registry = new LinkedHashMap<>();

    public ActionMetadataRegistry() {
        // Navigation
        put(ActionType.NAVIGATE, "Navigation", "Sayfa Aç",
                "Belirtilen URL'e git", null, "Tam URL veya path");
        put(ActionType.NAVIGATE_BACK, "Navigation", "Geri Git",
                "Tarayici geri butonu", null, null);
        put(ActionType.NAVIGATE_FORWARD, "Navigation", "Ileri Git",
                "Tarayici ileri butonu", null, null);
        put(ActionType.REFRESH, "Navigation", "Yenile",
                "Sayfayi yenile (F5)", null, null);

        // Mouse
        put(ActionType.CLICK, "Mouse", "Tikla", "Elemana tek tikla", null, null);
        put(ActionType.DOUBLE_CLICK, "Mouse", "Cift Tikla", "Elemana cift tikla", null, null);
        put(ActionType.RIGHT_CLICK, "Mouse", "Sag Tikla", "Saga tikla (context menu)", null, null);
        put(ActionType.MIDDLE_CLICK, "Mouse", "Orta Tikla", "Tekerlek tiklamasi", null, null);
        put(ActionType.HOVER, "Mouse", "Uzerine Gel", "Mouse hover", null, null);
        put(ActionType.DRAG_AND_DROP, "Mouse", "Surukle-Birak",
                "Bir elemandan digerine surukle", "Source selector kullanilir",
                "Target selector (CSS/XPath)");
        put(ActionType.CLICK_AT_OFFSET, "Mouse", "Offset Tikla",
                "Eleman icinde belirli koordinata tikla", "x,y formatinda offset", null);

        // Keyboard / Input
        put(ActionType.TYPE, "Input", "Yaz", "Elemana metin yaz", "Yazilacak metin", null);
        put(ActionType.TYPE_SECRET, "Input", "Sifre Yaz",
                "Loglanmadan yaz (sifre/token icin)", "Hassas metin", null);
        put(ActionType.CLEAR, "Input", "Temizle", "Input alanini temizle", null, null);
        put(ActionType.SELECT_OPTION, "Input", "Dropdown Sec",
                "Dropdown'dan secim yap", "Option text veya value", null);
        put(ActionType.PRESS_KEY, "Input", "Tus Bas",
                "Tek bir tusa bas", "ENTER, TAB, ESCAPE, ARROW_DOWN...", null);
        put(ActionType.PRESS_KEY_COMBO, "Input", "Tus Kombinasyonu",
                "Birden fazla tusa ayni anda bas", "CTRL+A, SHIFT+TAB...", null);
        put(ActionType.UPLOAD_FILE, "Input", "Dosya Yukle",
                "File input'a dosya yukle", "Dosya tam yolu", null);
        put(ActionType.FOCUS, "Input", "Odakla", "Elemana focus ver", null, null);
        put(ActionType.BLUR, "Input", "Odagi Kaldir", "Elementan focus al", null, null);

        // Scrolling
        put(ActionType.SCROLL_TO_ELEMENT, "Scroll", "Elemana Kaydır",
                "Eleman gorunene kadar scroll", null, null);
        put(ActionType.SCROLL_TO_TOP, "Scroll", "En Üste",
                "Sayfanin en ustune git", null, null);
        put(ActionType.SCROLL_TO_BOTTOM, "Scroll", "En Alta",
                "Sayfanin en altina git", null, null);
        put(ActionType.SCROLL_BY_PIXELS, "Scroll", "Piksel Kaydır",
                "Belirli piksel miktari kaydir", "x,y formatinda (ornek: 0,500)", null);

        // Waits
        put(ActionType.WAIT_SECONDS, "Wait", "Bekle (sn)",
                "Sabit sure bekle", "Saniye sayisi", null);
        put(ActionType.WAIT_FOR_VISIBLE, "Wait", "Gorunur Bekle",
                "Eleman gorunur olana kadar", null, null);
        put(ActionType.WAIT_FOR_INVISIBLE, "Wait", "Gizli Bekle",
                "Eleman gizlenene kadar", null, null);
        put(ActionType.WAIT_FOR_CLICKABLE, "Wait", "Tiklanabilir Bekle",
                "Eleman tiklanabilir olana kadar", null, null);
        put(ActionType.WAIT_FOR_TEXT, "Wait", "Metin Bekle",
                "Elemanda belirli metin gorunene kadar", "Beklenen metin", null);
        put(ActionType.WAIT_FOR_URL, "Wait", "URL Bekle",
                "URL belirli icerige gelene kadar", "URL parcasi", null);

        // Assertions
        put(ActionType.ASSERT_VISIBLE, "Assert", "Gorunur mu?",
                "Eleman gorunur olmali", null, null);
        put(ActionType.ASSERT_NOT_VISIBLE, "Assert", "Gizli mi?",
                "Eleman gorunmemeli", null, null);
        put(ActionType.ASSERT_TEXT_EQUALS, "Assert", "Metin Esit mi?",
                "Eleman metni tam esitlik", "Beklenen metin (tam)", null);
        put(ActionType.ASSERT_TEXT_CONTAINS, "Assert", "Metin Iceriyor mu?",
                "Eleman metni icerir mi", "Beklenen alt metin", null);
        put(ActionType.ASSERT_TEXT_MATCHES_REGEX, "Assert", "Regex Eslesir mi?",
                "Eleman metni regex'e uyar mi", "Regex pattern", null);
        put(ActionType.ASSERT_URL_EQUALS, "Assert", "URL Esit mi?",
                "URL tam esitlik", "Beklenen URL", null);
        put(ActionType.ASSERT_URL_CONTAINS, "Assert", "URL Iceriyor mu?",
                "URL alt string", "URL parcasi", null);
        put(ActionType.ASSERT_TITLE_CONTAINS, "Assert", "Baslik Iceriyor mu?",
                "Sayfa basligi alt string", "Baslik parcasi", null);
        put(ActionType.ASSERT_ATTRIBUTE_EQUALS, "Assert", "Attribute Esit mi?",
                "Eleman attribute'unun degeri",
                "Beklenen deger", "Attribute adi (ornek: href)");
        put(ActionType.ASSERT_ELEMENT_COUNT, "Assert", "Eleman Sayisi",
                "Selector'a uyan eleman sayisi", "Beklenen sayi", null);
        put(ActionType.ASSERT_ENABLED, "Assert", "Aktif mi?",
                "Eleman aktif (enabled) mi", null, null);
        put(ActionType.ASSERT_DISABLED, "Assert", "Pasif mi?",
                "Eleman pasif (disabled) mi", null, null);

        // Frames / Tabs
        put(ActionType.SWITCH_FRAME, "Frame", "Frame'e Gec",
                "iframe icine gir", "Frame index/name (selector da olabilir)", null);
        put(ActionType.SWITCH_TO_PARENT_FRAME, "Frame", "Ust Frame",
                "Bir ust frame'e cik", null, null);
        put(ActionType.SWITCH_TO_DEFAULT_CONTENT, "Frame", "Ana Sayfa",
                "Tum frame'lerden cik", null, null);
        put(ActionType.SWITCH_TAB, "Frame", "Tab Degistir",
                "Belirtilen tab'a gec", "Tab index (0=ilk tab)", null);
        put(ActionType.OPEN_NEW_TAB, "Frame", "Yeni Tab Ac",
                "Yeni sekme ac", "URL (opsiyonel)", null);
        put(ActionType.CLOSE_TAB, "Frame", "Tab Kapat",
                "Aktif sekmeyi kapat", null, null);

        // Storage / Cookies
        put(ActionType.SET_COOKIE, "Storage", "Cookie Ekle",
                "Cookie set et", "Cookie name", "Cookie value");
        put(ActionType.DELETE_COOKIE, "Storage", "Cookie Sil",
                "Belirli cookie sil", "Cookie name", null);
        put(ActionType.CLEAR_COOKIES, "Storage", "Tum Cookie'leri Sil",
                "Tum cookie'leri temizle", null, null);
        put(ActionType.SET_LOCAL_STORAGE, "Storage", "LocalStorage Ekle",
                "localStorage'a deger yaz", "Key", "Value");
        put(ActionType.CLEAR_LOCAL_STORAGE, "Storage", "LocalStorage Temizle",
                "localStorage'i tamamen temizle", null, null);

        // Misc
        put(ActionType.SCREENSHOT, "Misc", "Ekran Goruntusu",
                "Sayfanin screenshotunu al",
                null, null);
        put(ActionType.EXECUTE_SCRIPT, "Misc", "JS Calistir",
                "Sayfada JavaScript calistir", "JS kodu", null);
        put(ActionType.LOG_MESSAGE, "Misc", "Log Yaz",
                "Test loguna mesaj yaz", "Log metni", null);
        put(ActionType.SLEEP_RANDOM, "Misc", "Rastgele Bekle",
                "min-max araligi rastgele bekle (ms)", "min,max formatinda", null);
    }

    private void put(ActionType type, String category, String displayName,
                     String description, String inputHint, String secondaryHint) {
        registry.put(type, new Meta(category, displayName, description, inputHint, secondaryHint));
    }

    public List<ActionMetadataResponse> listAll() {
        return registry.entrySet().stream()
                .map(e -> {
                    ActionType t = e.getKey();
                    Meta m = e.getValue();
                    return new ActionMetadataResponse(
                            t,
                            m.category,
                            m.displayName,
                            m.description,
                            t.requiresSelector(),
                            t.requiresInputValue(),
                            t.requiresSecondaryValue(),
                            m.inputHint,
                            m.secondaryHint,
                            t.isSensitive()
                    );
                })
                .toList();
    }

    private record Meta(String category, String displayName, String description,
                        String inputHint, String secondaryHint) {}
}