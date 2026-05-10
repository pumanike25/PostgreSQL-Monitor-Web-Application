package pg_ai_monitor_backend;

import com.monitor.controller.MetricsController;
import com.monitor.model.SystemMetrics;
import com.monitor.service.AiAnalyzerService;
import com.monitor.service.MetricsCollectorService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class MetricsControllerTest {

    @Mock
    private MetricsCollectorService metricsCollectorService;

    @Mock
    private AiAnalyzerService aiAnalyzerService;

    @InjectMocks
    private MetricsController metricsController;

    @BeforeEach
    public void setUp() {
        // Initialize mock dependencies before each test execution
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void testGetCurrentMetrics() {
        // Arrange: Prepare dummy runtime metric data
        SystemMetrics mockMetrics = new SystemMetrics(25.0, 8192.0, 10, "SELECT * FROM users");
        Mockito.when(metricsCollectorService.collectMetrics()).thenReturn(mockMetrics);

        // Act: Invoke the target controller endpoint directly
        SystemMetrics result = metricsController.getCurrentMetrics();

        // Assert: Validate structural integrity of the returned payload
        Assertions.assertNotNull(result, "Metrics payload object should not be null");
        Assertions.assertEquals(25.0, result.cpuUsage(), "CPU usage extraction mismatch");
        Assertions.assertEquals(8192.0, result.memoryUsageMb(), "Memory allocation mismatch");
        Assertions.assertEquals(10, result.activeConnections(), "Active connection count mismatch");
        Assertions.assertEquals("SELECT * FROM users", result.slowestQuery(), "Slowest tracked query mismatch");
    }

    @Test
    public void testGetTopQueries() {
        // Arrange: Mock the execution bottleneck payload list
        List<Map<String, Object>> mockTopQueries = List.of(
                Map.of("query", "SELECT * FROM orders", "total_time", 150.5, "calls", 50)
        );
        Mockito.when(metricsCollectorService.getTopQueries()).thenReturn(mockTopQueries);

        // Act: Execute the query retrieval endpoint
        List<Map<String, Object>> result = metricsController.getTopQueries();

        // Assert: Ensure payload list structure maps perfectly
        Assertions.assertNotNull(result, "Top queries list payload should not be null");
        Assertions.assertEquals(1, result.size(), "Tracked query array size mismatch");
        Assertions.assertEquals("SELECT * FROM orders", result.get(0).get("query"), "Query statement string mismatch");
    }

    @Test
    public void testGetHealthStatus() {
        // Arrange: Simulate active database availability heartbeat
        Mockito.when(metricsCollectorService.isDatabaseOnline()).thenReturn(true);

        // Act: Retrieve overall system health indicators
        Map<String, Boolean> result = metricsController.getHealth();

        // Assert: Verify dual-component operational availability flags
        Assertions.assertNotNull(result, "System health state map should not be null");
        Assertions.assertTrue(result.get("database"), "Database link status should report as true");
        Assertions.assertTrue(result.get("backend"), "API runtime availability flag should resolve as true");
    }

    @Test
    public void testGetCsvHistoryFallback() {
        // Act: Parse local CSV enterprise audit records from persistent storage
        List<Map<String, Object>> result = metricsController.getCsvHistory();

        // Assert: Verify robust file read fallbacks execute without unhandled exceptions
        Assertions.assertNotNull(result, "CSV audit log history array should never return null");
    }

    @Test
    public void testGetAdvancedDbMetrics() {
        // Arrange: Mock storage size counters and transaction deadlock tracking maps
        Map<String, Object> mockAdvanced = Map.of("deadlocks", 0, "dbSizeMb", 1024.5);
        Mockito.when(metricsCollectorService.getAdvancedDbMetrics()).thenReturn(mockAdvanced);

        // Act: Fetch underlying physical structural metrics
        Map<String, Object> result = metricsController.getAdvancedDbMetrics();

        // Assert: Confirm correct resolution of advanced map parameters
        Assertions.assertNotNull(result, "Advanced metrics data dictionary should not be null");
        Assertions.assertEquals(0, result.get("deadlocks"), "Transaction deadlock counter mismatch");
        Assertions.assertEquals(1024.5, result.get("dbSizeMb"), "Database physical size allocation mismatch");
    }

    @Test
    public void testGenerateAiReport() {
        // Arrange: Mock real-time metrics collection alongside valid Groq JSON payload response
        SystemMetrics mockMetrics = new SystemMetrics(10.0, 2048.0, 2, "N/A");
        Mockito.when(metricsCollectorService.collectMetrics()).thenReturn(mockMetrics);
        Mockito.when(aiAnalyzerService.getInsights(Mockito.any(), Mockito.eq("en")))
                .thenReturn("{\"healthStatus\": \"Optimal\"}");

        // Act: Call the correct controller method name (generateAiReport)
        String result = metricsController.generateAiReport("en");

        // Assert: Confirm structural JSON content resolution
        Assertions.assertTrue(result.contains("Optimal"), "AI summary text payload extraction mismatch");
    }

    @Test
    public void testExplainQueryEndpoint() {
        // Arrange: Mock discrete performance query analysis payload parameters
        Map<String, String> payload = Map.of("query", "SELECT sleep(10)", "lang", "en");
        Mockito.when(aiAnalyzerService.explainQuery("SELECT sleep(10)", "en"))
                .thenReturn("{\"whatItDoes\": \"Pauses execution\"}");

        // Act: Pass target request map down to the underlying AI service
        String result = metricsController.explainQuery(payload);

        // Assert: Verify targeted performance optimization tips resolve correctly
        Assertions.assertTrue(result.contains("Pauses execution"), "Targeted SQL query explanation mismatch");
    }
}