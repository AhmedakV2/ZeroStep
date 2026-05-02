package com.ahmedv2.zerostep.execution.driver;

import com.ahmedv2.zerostep.config.properties.AppProperties;
// Not: ExecutionMetrics sınıfının tam paket yolunu kendi projene göre düzenlemelisin.
import com.ahmedv2.zerostep.execution.metrics.ExecutionMetrics;
import com.ahmedv2.zerostep.scenario.entity.BrowserConfig;
import io.github.bonigarcia.wdm.WebDriverManager;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

// WebDriver pool; sistem genelinde max N paralel browser
// Semaphore ile concurrency kontrolu; capacity dolarsa caller bekler
@Component
@RequiredArgsConstructor
@Slf4j
public class WebDriverPool {

    private final AppProperties appProperties;
    private final ExecutionMetrics executionMetrics; // Metrics eklendi
    private Semaphore semaphore;

    @PostConstruct
    void init() {
        int max = appProperties.getExecution().getMaxConcurrentDrivers();
        this.semaphore = new Semaphore(max, true);
        // ChromeDriver binary'sini otomatik indir/cache et (ilk run da internet gerekir)
        WebDriverManager.chromedriver().setup();
        log.info("WebDriverPool hazir; max paralel driver={}", max);
    }

    @PreDestroy
    void shutdown() {
        log.info("WebDriverPool kapatildi");
    }

    // Pool'dan driver al; max N tane ayni anda; timeout asilirsa exception
    public WebDriver acquire(BrowserConfig browserConfig) throws InterruptedException {
        int timeout = appProperties.getExecution().getAcquireTimeoutSeconds();
        boolean acquired = semaphore.tryAcquire(timeout, TimeUnit.SECONDS);
        if (!acquired) {
            throw new IllegalStateException(
                    "WebDriver pool'da bos slot bulunamadi (" + timeout + "s timeout)");
        }

        // tryAcquire basariliysa metrik artir
        executionMetrics.driverAcquired();

        try {
            WebDriver driver = createDriver(browserConfig);
            log.debug("Driver acquired; available permits={}", semaphore.availablePermits());
            return driver;
        } catch (RuntimeException e) {
            // Driver olusturulamadi; semaphore release et ve metrikleri dengele
            semaphore.release();
            executionMetrics.driverReleased();
            throw e;
        }
    }

    // Driver iade; quit() yapip semaphore release
    public void release(WebDriver driver) {
        try {
            if (driver != null) {
                driver.quit();
                log.debug("Driver released; available permits={}", semaphore.availablePermits() + 1);
            }
        } catch (Exception e) {
            log.warn("Driver quit hata; ignore", e);
        } finally {
            semaphore.release();
            // finally bloğunda metrik azalt
            executionMetrics.driverReleased();
        }
    }

    // ============================================================
    // Driver factory
    // ============================================================
    private WebDriver createDriver(BrowserConfig browserConfig) {
        ChromeOptions options = buildChromeOptions(browserConfig);
        ChromeDriver driver = new ChromeDriver(options);

        // Timeouts
        var timeouts = driver.manage().timeouts();
        timeouts.pageLoadTimeout(Duration.ofSeconds(
                appProperties.getExecution().getPageLoadTimeoutSeconds()));
        timeouts.implicitlyWait(Duration.ofSeconds(
                appProperties.getExecution().getImplicitWaitSeconds()));

        // Window size; browserConfig override > app default
        int width = browserConfig != null && browserConfig.getViewportWidth() > 0
                ? browserConfig.getViewportWidth()
                : appProperties.getExecution().getWindowWidth();
        int height = browserConfig != null && browserConfig.getViewportHeight() > 0
                ? browserConfig.getViewportHeight()
                : appProperties.getExecution().getWindowHeight();
        driver.manage().window().setSize(new Dimension(width, height));

        return driver;
    }

    private ChromeOptions buildChromeOptions(BrowserConfig browserConfig) {
        ChromeOptions options = new ChromeOptions();

        // Headless karari: scenario config > app default
        boolean headless = browserConfig != null
                ? browserConfig.isHeadless()
                : appProperties.getExecution().isHeadless();

        if (headless) {
            options.addArguments("--headless=new");
        }

        // Sandbox + sabit flagler; CI/Docker ortaminda guvenli
        options.addArguments(
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-extensions",
                "--disable-popup-blocking",
                "--remote-allow-origins=*"
        );

        if (browserConfig != null && browserConfig.getUserAgent() != null
                && !browserConfig.getUserAgent().isBlank()) {
            options.addArguments("--user-agent=" + browserConfig.getUserAgent());
        }

        return options;
    }
}