package com.ahmedv2.zerostep.execution.handler;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

public  final class WaitUtil {


    private WaitUtil() {}

    public static WebElement waitVisible(WebDriver driver, By by, int seconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(seconds))
                .until(ExpectedConditions.visibilityOfElementLocated(by));
    }

    public static WebElement waitClickable(WebDriver driver, By by, int seconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(seconds))
                .until(ExpectedConditions.elementToBeClickable(by));
    }

    public static boolean waitInvisibility(WebDriver driver, By by, int seconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(seconds))
                .until(ExpectedConditions.invisibilityOfElementLocated(by));
    }

    public static WebElement WaitPresent(WebDriver driver , By by ,int seconds) {
        return new WebDriverWait(driver ,Duration.ofSeconds(seconds))
                .until(ExpectedConditions.presenceOfElementLocated(by));
    }
}
