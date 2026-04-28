package com.ahmedv2.zerostep.step.entity;

import java.util.Set;

// 50 farkli aksiyon; her birinin runtime davranisi Faz 5'te ActionHandler'larda tanimlanir
public enum ActionType {

    // ==================== Navigation ====================
    NAVIGATE,                       // inputValue: target URL
    NAVIGATE_BACK,                  // browser.back()
    NAVIGATE_FORWARD,               // browser.forward()
    REFRESH,                        // F5

    // ==================== Mouse ====================
    CLICK,
    DOUBLE_CLICK,
    RIGHT_CLICK,
    MIDDLE_CLICK,
    HOVER,
    DRAG_AND_DROP,                  // selector=source, secondaryValue=target selector
    CLICK_AT_OFFSET,                // selector + inputValue="x,y" offset

    // ==================== Keyboard / Input ====================
    TYPE,                           // selector + inputValue
    TYPE_SECRET,                    // selector + inputValue (loglarda maskelenir)
    CLEAR,
    SELECT_OPTION,                  // selector + inputValue (visible text veya value)
    PRESS_KEY,                      // inputValue: ENTER, TAB, ESCAPE, ARROW_DOWN...
    PRESS_KEY_COMBO,                // inputValue: "CTRL+A", "SHIFT+TAB"
    UPLOAD_FILE,                    // selector + inputValue (file path)
    FOCUS,
    BLUR,

    // ==================== Scrolling ====================
    SCROLL_TO_ELEMENT,              // selector
    SCROLL_TO_TOP,
    SCROLL_TO_BOTTOM,
    SCROLL_BY_PIXELS,               // inputValue: "x,y"

    // ==================== Waits ====================
    WAIT_SECONDS,                   // inputValue: saniye
    WAIT_FOR_VISIBLE,
    WAIT_FOR_INVISIBLE,
    WAIT_FOR_CLICKABLE,
    WAIT_FOR_TEXT,                  // selector + inputValue (beklenen metin)
    WAIT_FOR_URL,                   // inputValue: URL parcasi

    // ==================== Assertions ====================
    ASSERT_VISIBLE,
    ASSERT_NOT_VISIBLE,
    ASSERT_TEXT_EQUALS,             // selector + inputValue
    ASSERT_TEXT_CONTAINS,
    ASSERT_TEXT_MATCHES_REGEX,
    ASSERT_URL_EQUALS,              // inputValue
    ASSERT_URL_CONTAINS,
    ASSERT_TITLE_CONTAINS,          // inputValue: title parcasi
    ASSERT_ATTRIBUTE_EQUALS,        // selector + inputValue=expected, secondaryValue=attribute name
    ASSERT_ELEMENT_COUNT,           // selector + inputValue: beklenen sayi
    ASSERT_ENABLED,
    ASSERT_DISABLED,

    // ==================== Frames / Tabs ====================
    SWITCH_FRAME,                   // selector veya inputValue (index/name)
    SWITCH_TO_PARENT_FRAME,
    SWITCH_TO_DEFAULT_CONTENT,
    SWITCH_TAB,                     // inputValue: tab index
    OPEN_NEW_TAB,                   // inputValue: URL (opsiyonel)
    CLOSE_TAB,

    // ==================== Storage / Cookies ====================
    SET_COOKIE,                     // inputValue=name, secondaryValue=value
    DELETE_COOKIE,                  // inputValue: cookie adi
    CLEAR_COOKIES,
    SET_LOCAL_STORAGE,              // inputValue=key, secondaryValue=value
    CLEAR_LOCAL_STORAGE,

    // ==================== Misc ====================
    SCREENSHOT,                     // description: dosya adi
    EXECUTE_SCRIPT,                 // inputValue: JS kodu
    LOG_MESSAGE,                    // inputValue: log metni
    SLEEP_RANDOM;                   // inputValue: "min,max" milisaniye

    // ============================================================
    // Action gereksinim metadatasi
    // ============================================================

    // Selector zorunlu olan action'lar
    private static final Set<ActionType> REQUIRES_SELECTOR = Set.of(
            CLICK, DOUBLE_CLICK, RIGHT_CLICK, MIDDLE_CLICK,
            HOVER, DRAG_AND_DROP, CLICK_AT_OFFSET,
            TYPE, TYPE_SECRET, CLEAR, SELECT_OPTION,
            UPLOAD_FILE, FOCUS, BLUR,
            SCROLL_TO_ELEMENT,
            WAIT_FOR_VISIBLE, WAIT_FOR_INVISIBLE, WAIT_FOR_CLICKABLE, WAIT_FOR_TEXT,
            ASSERT_VISIBLE, ASSERT_NOT_VISIBLE,
            ASSERT_TEXT_EQUALS, ASSERT_TEXT_CONTAINS, ASSERT_TEXT_MATCHES_REGEX,
            ASSERT_ATTRIBUTE_EQUALS, ASSERT_ELEMENT_COUNT,
            ASSERT_ENABLED, ASSERT_DISABLED
    );

    // inputValue zorunlu olan action'lar
    private static final Set<ActionType> REQUIRES_INPUT = Set.of(
            NAVIGATE, CLICK_AT_OFFSET,
            TYPE, TYPE_SECRET, SELECT_OPTION,
            PRESS_KEY, PRESS_KEY_COMBO, UPLOAD_FILE,
            SCROLL_BY_PIXELS,
            WAIT_SECONDS, WAIT_FOR_TEXT, WAIT_FOR_URL,
            ASSERT_TEXT_EQUALS, ASSERT_TEXT_CONTAINS, ASSERT_TEXT_MATCHES_REGEX,
            ASSERT_URL_EQUALS, ASSERT_URL_CONTAINS,
            ASSERT_TITLE_CONTAINS, ASSERT_ATTRIBUTE_EQUALS, ASSERT_ELEMENT_COUNT,
            SWITCH_TAB,
            SET_COOKIE, DELETE_COOKIE, SET_LOCAL_STORAGE,
            EXECUTE_SCRIPT, LOG_MESSAGE, SLEEP_RANDOM
    );

    // secondaryValue zorunlu olan action'lar (iki parametre alanlar)
    private static final Set<ActionType> REQUIRES_SECONDARY = Set.of(
            DRAG_AND_DROP, ASSERT_ATTRIBUTE_EQUALS,
            SET_COOKIE, SET_LOCAL_STORAGE
    );

    public boolean requiresSelector() {
        return REQUIRES_SELECTOR.contains(this);
    }

    public boolean requiresInputValue() {
        return REQUIRES_INPUT.contains(this);
    }

    public boolean requiresSecondaryValue() {
        return REQUIRES_SECONDARY.contains(this);
    }

    // Loglarda maskelenmesi gereken hassas action'lar
    public boolean isSensitive() {
        return this == TYPE_SECRET;
    }
}