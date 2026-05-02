package com.ahmedv2.zerostep.scenario;

import com.ahmedv2.zerostep.base.IntegrationTestBase;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("Scenario Controller IT")
class ScenarioControllerIT extends IntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String accessToken;

    @BeforeEach
    void setup() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"Admin123!"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        accessToken = objectMapper.readTree(
                        result.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();
    }

    @Test
    @DisplayName("Auth olmadan senaryo listesi 401 donmeli")
    void listScenarios_withoutAuth_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/scenarios"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Admin token ile senaryo olusturma 201 donmeli")
    void createScenario_withAdminToken_shouldReturn201() throws Exception {
        mockMvc.perform(post("/api/v1/scenarios")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "IT Test Senaryosu",
                                  "baseUrl": "https://example.com"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("IT Test Senaryosu"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
    }

    @Test
    @DisplayName("Ayni isimde iki senaryo 409 donmeli")
    void createDuplicateScenario_shouldReturn409() throws Exception {
        String body = """
                {"name":"Duplicate Senaryo","baseUrl":"https://example.com"}
                """;

        mockMvc.perform(post("/api/v1/scenarios")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/scenarios")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }
}