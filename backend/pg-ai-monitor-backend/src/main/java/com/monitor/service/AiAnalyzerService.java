package com.monitor.service;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.monitor.model.SystemMetrics;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class AiAnalyzerService {

    @Value("${groq.api.key}")
    private String apiKey;

    private static final String API_URL = "https://api.groq.com/openai/v1/chat/completions";

    public String getInsights(SystemMetrics metrics, String lang) {
        // Validate the dynamically injected key
        if (apiKey == null || apiKey.isEmpty() || apiKey.contains("YOUR_GROQ")) {
            return "{\"error\": \"API key not configured\"}";
        }

        // Set target language for the prompt
        String targetLanguage = lang.equalsIgnoreCase("ro") ? "Romanian" : "English";

        // Build the prompt string
        String prompt = String.format(
            "You are a PostgreSQL expert. Analyze these metrics: CPU: %.2f%%, RAM: %.2f MB, Conns: %d, Slowest Query: '%s'. " +
            "Return ONLY a valid JSON object with exactly three string fields: " +
            "1. 'healthStatus' (A short sentence summarizing overall health). " +
            "2. 'identifiedRisks' (Any potential issues noticed). " +
            "3. 'recommendations' (Actionable advice). " +
            "CRITICAL INSTRUCTION: All the text values inside the JSON MUST be written in %s. " +
            "Do not include any markdown formatting, backticks, or extra text.",
            metrics.cpuUsage(), metrics.memoryUsageMb(), metrics.activeConnections(), metrics.slowestQuery(), targetLanguage
        );

        JsonObject message = new JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", prompt);

        JsonArray messagesArray = new JsonArray();
        messagesArray.add(message);

        JsonObject requestBody = new JsonObject();
        requestBody.addProperty("model", "llama-3.1-8b-instant");
        requestBody.add("messages", messagesArray);
        
        JsonObject responseFormat = new JsonObject();
        responseFormat.addProperty("type", "json_object");
        requestBody.add("response_format", responseFormat);

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey) // Use the injected key here
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                JsonObject jsonResponse = JsonParser.parseString(response.body()).getAsJsonObject();
                return jsonResponse
                        .getAsJsonArray("choices").get(0).getAsJsonObject()
                        .getAsJsonObject("message")
                        .get("content").getAsString();
            } else {
                 return "{\"error\": \"API Error: " + response.statusCode() + "\"}";
            }
        } catch (Exception e) {
             return "{\"error\": \"Connection Error: " + e.getMessage() + "\"}";
        }
    }

    public String explainQuery(String sqlQuery, String lang) {
        // Validate the dynamically injected key
        if (apiKey == null || apiKey.isEmpty() || apiKey.contains("YOUR_GROQ")) {
            return "{\"error\": \"API key not configured\"}";
        }

        String targetLanguage = lang.equalsIgnoreCase("ro") ? "Romanian" : "English";

        // Ask the AI for this query's explanation 
        String prompt = String.format(
            "You are a PostgreSQL tuning expert. Analyze this resource-intensive query: '%s'. " +
            "Return ONLY a valid JSON object with exactly two string fields: " +
            "1. 'whatItDoes' (Explain simply what the query fetches or does). " +
            "2. 'optimizationTip' (Actionable advice to make it faster, e.g., missing indexes). " +
            "CRITICAL INSTRUCTION: All text values MUST be written in %s. " +
            "Do not include any markdown formatting, backticks, or extra text.",
            sqlQuery.replace("\"", "'").replace("\n", " "), targetLanguage
        );

        com.google.gson.JsonObject message = new com.google.gson.JsonObject();
        message.addProperty("role", "user");
        message.addProperty("content", prompt);

        com.google.gson.JsonArray messagesArray = new com.google.gson.JsonArray();
        messagesArray.add(message);

        com.google.gson.JsonObject requestBody = new com.google.gson.JsonObject();
        requestBody.addProperty("model", "llama-3.1-8b-instant");
        requestBody.add("messages", messagesArray);
        
        com.google.gson.JsonObject responseFormat = new com.google.gson.JsonObject();
        responseFormat.addProperty("type", "json_object");
        requestBody.add("response_format", responseFormat);

        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(10))
                    .build();

            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(API_URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey) // Use the injected key here
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(requestBody.toString()))
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                com.google.gson.JsonObject jsonResponse = com.google.gson.JsonParser.parseString(response.body()).getAsJsonObject();
                return jsonResponse
                        .getAsJsonArray("choices").get(0).getAsJsonObject()
                        .getAsJsonObject("message")
                        .get("content").getAsString();
            } else {
                 return "{\"error\": \"API Error: " + response.statusCode() + "\"}";
            }
        } catch (Exception e) {
             return "{\"error\": \"Connection Error: " + e.getMessage() + "\"}";
        }
    }
}