package pg_ai_monitor_backend;

import com.monitor.model.SystemMetrics;
import com.monitor.service.MetricsCollectorService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class MetricsCollectorServiceTest {

    // Mock the Spring JDBC Template to simulate database queries entirely in memory
    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private MetricsCollectorService metricsCollectorService;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void testCollectMetricsSuccess() {
        // Arrange: Simulate active connections count and slowest query returning valid data
        Mockito.when(jdbcTemplate.queryForObject(
                Mockito.contains("pg_stat_activity"), Mockito.eq(Integer.class)))
                .thenReturn(42);

        Mockito.when(jdbcTemplate.queryForObject(
                Mockito.contains("pg_stat_statements"), Mockito.eq(String.class)))
                .thenReturn("SELECT * FROM heavy_table");

        // Act: Execute full collection (this will also read real hardware RAM/CPU via Oshi)
        SystemMetrics result = metricsCollectorService.collectMetrics();

        // Assert: Validate DB metrics and ensure hardware metrics are computed safely (> 0)
        Assertions.assertNotNull(result, "Collected metrics should not be null");
        Assertions.assertEquals(42, result.activeConnections(), "Active connections count failed");
        Assertions.assertEquals("SELECT * FROM heavy_table", result.slowestQuery(), "Slowest query extraction failed");
        Assertions.assertTrue(result.memoryUsageMb() >= 0, "RAM calculation should be non-negative");
        Assertions.assertTrue(result.cpuUsage() >= 0, "CPU calculation should be non-negative");
    }

    @Test
    public void testCollectMetricsDatabaseFailureSafeFallback() {
        // Arrange: Force PostgreSQL queries to throw Runtime Exceptions (simulating DB crash)
        Mockito.when(jdbcTemplate.queryForObject(Mockito.anyString(), Mockito.eq(Integer.class)))
                .thenThrow(new RuntimeException("Database connection refused"));

        Mockito.when(jdbcTemplate.queryForObject(Mockito.anyString(), Mockito.eq(String.class)))
                .thenThrow(new RuntimeException("Extension missing"));

        // Act: System must NOT crash, it should catch exceptions and apply default fallbacks
        SystemMetrics result = metricsCollectorService.collectMetrics();

        // Assert: Verify safe default values are applied
        Assertions.assertEquals(0, result.activeConnections(), "Fallback for connections should be 0");
        Assertions.assertTrue(result.slowestQuery().contains("N/A") || result.slowestQuery().contains("inactive"), 
                "Fallback for missing queries failed");
    }

    @Test
    public void testIsDatabaseOnlineTrue() {
        // Arrange: Simulate successful heartbeat execution
        Mockito.doNothing().when(jdbcTemplate).execute(Mockito.anyString());

        // Act & Assert
        Assertions.assertTrue(metricsCollectorService.isDatabaseOnline(), "DB should be reported online");
    }

    @Test
    public void testIsDatabaseOnlineFalseOnException() {
        // Arrange: Simulate heartbeat timeout/failure
        Mockito.doThrow(new RuntimeException("Timeout")).when(jdbcTemplate).execute(Mockito.anyString());

        // Act & Assert
        Assertions.assertFalse(metricsCollectorService.isDatabaseOnline(), "DB should be reported offline on error");
    }

    @Test
    public void testGetAdvancedDbMetricsExecution() {
        // Arrange: Mock size calculations and deadlock counters
        Mockito.when(jdbcTemplate.queryForObject(Mockito.contains("deadlocks"), Mockito.eq(Integer.class)))
                .thenReturn(3);
        Mockito.when(jdbcTemplate.queryForObject(Mockito.contains("pg_database_size"), Mockito.eq(Double.class)))
                .thenReturn(500.25);
        Mockito.when(jdbcTemplate.queryForList(Mockito.contains("pg_statio_user_tables")))
                .thenReturn(Collections.emptyList());

        // Act
        Map<String, Object> result = metricsCollectorService.getAdvancedDbMetrics();

        // Assert
        Assertions.assertEquals(3, result.get("deadlocks"), "Deadlock count extraction failed");
        Assertions.assertEquals(500.25, result.get("dbSizeMb"), "Database size extraction failed");
        Assertions.assertNotNull(result.get("topTables"), "Top tables list should be initialized");
    }
}