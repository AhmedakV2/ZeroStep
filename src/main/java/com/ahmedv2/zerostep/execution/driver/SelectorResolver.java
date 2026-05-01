package com.ahmedv2.zerostep.execution.driver;

import com.ahmedv2.zerostep.step.entity.SelectorType;
import org.openqa.selenium.By;
import org.springframework.stereotype.Component;

@Component
public class SelectorResolver {

    public By resolve(SelectorType type, String value) {
        if (type == null || value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    "Bu adim icin selector_type ve selector_value zorunlu");
        }
        return switch (type) {
            case CSS                 ->By.cssSelector(value);
            case XPATH               ->By.xpath(value);
            case ID                  ->By.id(value);
            case NAME                ->By.name(value);
            case CLASS_NAME          ->By.className(value);
            case TAG_NAME            ->By.tagName(value);
            case LINK_TEXT           ->By.linkText(value);
            case PARTIAL_LINK_TEXT   ->By.partialLinkText(value);
        };
    }
}
