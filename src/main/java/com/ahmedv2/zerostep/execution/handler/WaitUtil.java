package com.ahmedv2.zerostep.execution.handler;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public class WaitUtil {

    // Element DOM'da ve görünür olana kadar bekler
    public static WebElement waitVisible(WebDriver driver, By by, int timeoutSeconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds))
                .until(ExpectedConditions.visibilityOfElementLocated(by));
    }

    // Element tıklanabilir olana kadar bekler
    public static WebElement waitClickable(WebDriver driver, By by, int timeoutSeconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds))
                .until(ExpectedConditions.elementToBeClickable(by));
    }

    // Element DOM'dan kaybolana kadar bekler
    public static boolean waitInvisible(WebDriver driver, By by, int timeoutSeconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds))
                .until(ExpectedConditions.invisibilityOfElementLocated(by));
    }

    // Element sadece DOM'da mevcut olana kadar bekler (görünür olmak zorunda değil)
    public static WebElement waitPresent(WebDriver driver, By by, int timeoutSeconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds))
                .until(ExpectedConditions.presenceOfElementLocated(by));
    }
}