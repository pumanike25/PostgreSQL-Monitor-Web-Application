package pg_ai_monitor_backend;

import com.monitor.model.SystemMetrics;
import com.monitor.service.AiAnalyzerService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.MockitoAnnotations;

public class AiAnalyzerServiceTest {

    @InjectMocks
    private AiAnalyzerService aiAnalyzerService;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void testGetInsightsMissingApiKeyHandling() {
        // Arrange: Prepare dummy metrics
        SystemMetrics dummyMetrics = new SystemMetrics(95.0, 15000.0, 120, "SELECT * FROM logs");

        // Act: Attempt analysis without setting a valid Groq API Key
        String result = aiAnalyzerService.getInsights(dummyMetrics, "en");

        // Assert: Service must catch the invalid key/unauthorized response safely and return a JSON error string
        Assertions.assertNotNull(result, "AI response should not be null");
    }

    @Test
    public void testExplainQueryErrorHandling() {
        // Act: Request explanation for a slow query
        String result = aiAnalyzerService.explainQuery("SELECT * FROM huge_table CROSS JOIN massive_table", "en");

        // Assert: Ensure robust JSON string output even on HTTP client execution failures
        Assertions.assertNotNull(result, "Explanation response output must be initialized");
        Assertions.assertTrue(result.startsWith("{") && result.endsWith("}"), 
                "Output must always remain a valid JSON formatted string");
    }
}