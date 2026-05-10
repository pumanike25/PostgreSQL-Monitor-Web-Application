package com.monitor.controller;

import com.monitor.model.SystemMetrics;
import com.monitor.service.AiAnalyzerService;
import com.monitor.service.MetricsCollectorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/metrics")
@CrossOrigin(origins = "*") // Allows the React frontend to fetch payloads safely
public class MetricsController {

    private final MetricsCollectorService metricsCollectorService;
    private final AiAnalyzerService aiAnalyzerService;

    @Autowired
    public MetricsController(MetricsCollectorService metricsCollectorService, AiAnalyzerService aiAnalyzerService) {
        this.metricsCollectorService = metricsCollectorService;
        this.aiAnalyzerService = aiAnalyzerService;
    }

    //Endpoint 1: Provides live CPU, RAM, and connection counts. Triggers a persistent CSV audit append on execution.
 
    @GetMapping("/current")
    public SystemMetrics getCurrentMetrics() {
        return metricsCollectorService.collectMetrics();
    }

    //Endpoint 2: Returns the top 5 costliest runtime queries.
    @GetMapping("/top-queries")
    public List<Map<String, Object>> getTopQueries() {
        return metricsCollectorService.getTopQueries();
    }

    //Endpoint 3: Reports the general operational status of the backend links.
    @GetMapping("/health")
    public Map<String, Boolean> getHealth() {
        Map<String, Boolean> health = new HashMap<>();
        health.put("database", metricsCollectorService.isDatabaseOnline());
        health.put("backend", true); // Backend is explicitly available if this resolves
        return health;
    }

    //Endpoint 4: Exposes the full local storage audit history parsed directly from the disk.
    @GetMapping("/history")
    public List<Map<String, Object>> getCsvHistory() {
        return metricsCollectorService.getCsvHistoryAsMap();
    }

    //Endpoint 5: Delivers advanced physical database metrics (storage space, relation weights, locks).
    @GetMapping("/advanced-db")
    public Map<String, Object> getAdvancedDbMetrics() {
        return metricsCollectorService.getAdvancedDbMetrics();
    }

    //Endpoint 6: Generates the overarching Groq AI system analysis report.
    @GetMapping("/ai-report")
    public String generateAiReport(@RequestParam(defaultValue = "en") String lang) {
        SystemMetrics currentMetrics = metricsCollectorService.collectMetrics();
        return aiAnalyzerService.getInsights(currentMetrics, lang);
    }

    //Endpoint 7: Queries the AI engine to generate an isolated, highly targeted SQL explanation.
    @PostMapping("/explain-query")
    public String explainQuery(@RequestBody Map<String, String> payload) {
        String query = payload.getOrDefault("query", "");
        String lang = payload.getOrDefault("lang", "en");
        return aiAnalyzerService.explainQuery(query, lang);
    }
}