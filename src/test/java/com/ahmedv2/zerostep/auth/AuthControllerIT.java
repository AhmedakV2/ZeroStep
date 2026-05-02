package com.ahmedv2.zerostep.auth;

import com.ahmedv2.zerostep.base.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("Auth Controller IT")
class AuthControllerIT extends IntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Gecerli bilgilerle login 200 donmeli")
    void loginWithValidCredentials_shouldReturn200() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"Admin123!"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());
    }

    @Test
    @DisplayName("Yanlis sifre ile login 401 donmeli")
    void loginWithWrongPassword_shouldReturn401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"WrongPass123!"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Eksik alan ile login 400 donmeli")
    void loginWithMissingFields_shouldReturn400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin"}
                                """))
                .andExpect(status().isBadRequest());
    }
}