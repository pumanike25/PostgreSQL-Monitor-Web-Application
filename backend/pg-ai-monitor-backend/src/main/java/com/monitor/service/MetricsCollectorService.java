package com.monitor.service;

import com.monitor.model.SystemMetrics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import oshi.SystemInfo;
import oshi.hardware.CentralProcessor;
import oshi.hardware.GlobalMemory;
import oshi.hardware.HardwareAbstractionLayer;

import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class MetricsCollectorService {

    private final JdbcTemplate jdbcTemplate;
    private final HardwareAbstractionLayer hardware;
    private final CentralProcessor processor;

    // We define the target log path here (can be moved inside sensitive_data/ if needed)
    private static final String CSV_FILE_PATH = "database_metrics.csv";

    @Autowired
    public MetricsCollectorService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        SystemInfo systemInfo = new SystemInfo();
        this.hardware = systemInfo.getHardware();
        this.processor = hardware.getProcessor();
    }

    //Collects real-time hardware and database metrics, appends them to the enterprise audit log, and returns the payload to the caller.
    public SystemMetrics collectMetrics() {
        // Create the core metrics payload
        SystemMetrics metrics = new SystemMetrics(
                getCpuUsage(),
                getMemoryUsageMb(),
                getActiveConnections(),
                getSlowestQuery()
        );
        
        // Persist the extended data directly to the CSV audit log
        saveMetricsToFile(metrics);

        return metrics;
    }

    //Appends an extended Enterprise Audit Log row directly to the local disk. Includes physical disk growth, runtime deadlocks, and an explicit system health status.
    private void saveMetricsToFile(SystemMetrics metrics) {
        // Fetch advanced metrics to capture real-time storage size and deadlocks
        Map<String, Object> advDb = getAdvancedDbMetrics();
        int deadlocks = advDb.containsKey("deadlocks") ? ((Number) advDb.get("deadlocks")).intValue() : 0;
        double dbSizeMb = advDb.containsKey("dbSizeMb") ? ((Number) advDb.get("dbSizeMb")).doubleValue() : 0.0;
        
        // Define an explicit health status threshold
        boolean isWarn = metrics.cpuUsage() > 80.0 || metrics.memoryUsageMb() > 14000.0 || deadlocks > 0;
        String sysHealth = isWarn ? "WARN" : "OK";

        // Build the extended CSV line
        // Format: TIMESTAMP, CPU_%, RAM_MB, CONNECTIONS, DB_SIZE_MB, DEADLOCKS, HEALTH
        String csvLine = String.format(Locale.US, "%s,%.2f,%.2f,%d,%.2f,%d,%s%n",
                LocalDateTime.now().toString(),
                metrics.cpuUsage(),
                metrics.memoryUsageMb(),
                metrics.activeConnections(),
                dbSizeMb,
                deadlocks,
                sysHealth
        );

        // Append the record securely to the local file
        try {
            Files.write(
                    Paths.get(CSV_FILE_PATH),
                    csvLine.getBytes(),
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND
            );
        } catch (IOException e) {
            System.err.println("Error appending to local CSV audit log: " + e.getMessage());
        }
    }
    
    private double getCpuUsage() {
        long[] prevTicks = processor.getSystemCpuLoadTicks();
        try {
            Thread.sleep(500); // 0.5s baseline delay for accurate tick reading
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return processor.getSystemCpuLoadBetweenTicks(prevTicks) * 100;
    }

    private double getMemoryUsageMb() {
        GlobalMemory memory = hardware.getMemory();
        long usedMemoryBytes = memory.getTotal() - memory.getAvailable();
        return usedMemoryBytes / (1024.0 * 1024.0);
    }

    private int getActiveConnections() {
        try {
            String sql = "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class);
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0; // Return safe default if the database connection drops
        }
    }

    private String getSlowestQuery() {
        String sql = "SELECT query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 1";
        try {
            return jdbcTemplate.queryForObject(sql, String.class);
        } catch (Exception e) {
            return "N/A (pg_stat_statements extension inactive)";
        }
    }

    //Extracts the top 5 most expensive execution queries currently tracked by PostgreSQL.
    public List<Map<String, Object>> getTopQueries() {
        String sql = "SELECT query, round(total_exec_time::numeric, 2) as total_time, calls " +
                     "FROM pg_stat_statements " +
                     "ORDER BY total_exec_time DESC LIMIT 5";
        try {
            return jdbcTemplate.queryForList(sql);
        } catch (Exception e) {
            return new ArrayList<>(); // Return an empty array if tracking is missing
        }
    }
    
    //Captures structural metrics: physical storage space, relation sizes, and fatal deadlocks.
    public Map<String, Object> getAdvancedDbMetrics() {
        Map<String, Object> map = new HashMap<>();
        
        //Count fatal transaction deadlocks on the current database
        try {
            String sqlDeadlocks = "SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()";
            Integer deadlocks = jdbcTemplate.queryForObject(sqlDeadlocks, Integer.class);
            map.put("deadlocks", deadlocks != null ? deadlocks : 0);
        } catch (Exception e) {
            map.put("deadlocks", 0);
        }
        
        //Extract total physical database size allocated on disk
        try {
            String sqlDbSize = "SELECT round((pg_database_size(current_database()) / (1024.0 * 1024.0))::numeric, 2)";
            Double dbSize = jdbcTemplate.queryForObject(sqlDbSize, Double.class);
            map.put("dbSizeMb", dbSize != null ? dbSize : 0.0);
        } catch (Exception e) {
            map.put("dbSizeMb", 0.0);
        }
        
        //Extract top 5 largest storage tables (including their indexes)
        try {
            String sqlTables = "SELECT relname AS table_name, " +
                               "round((pg_total_relation_size(relid) / (1024.0 * 1024.0))::numeric, 2) AS size_mb " +
                               "FROM pg_catalog.pg_statio_user_tables " +
                               "ORDER BY pg_total_relation_size(relid) DESC LIMIT 5";
            map.put("topTables", jdbcTemplate.queryForList(sqlTables));
        } catch (Exception e) {
            map.put("topTables", new ArrayList<>());
        }
        
        return map;
    }

    //Executes a fast verification heartbeat to check if the database is responding.
    public boolean isDatabaseOnline() {
        try {
            jdbcTemplate.execute("SELECT 1");
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    //Reads the persistent audit log from disk, mapping the extended columns.
    public List<Map<String, Object>> getCsvHistoryAsMap() {
        List<Map<String, Object>> records = new ArrayList<>();
        try {
            java.io.File file = new java.io.File(CSV_FILE_PATH);
            if (!file.exists()) return records;

            List<String> lines = Files.readAllLines(file.toPath());

            for (String line : lines) {
                if (line == null || line.trim().isEmpty()) continue;
                String[] parts = line.split(",");

                Map<String, Object> map = new HashMap<>();
                map.put("timestamp", parts[0].trim());

                try {
                    // Core columns
                    String cpuStr = parts.length > 1 ? parts[1].trim() : "0";
                    String memStr = parts.length > 2 ? parts[2].trim() : "0";
                    String connStr = parts.length > 3 ? parts[3].trim() : "0";
                    
                    // Extended enterprise audit columns
                    String dbSizeStr = parts.length > 4 ? parts[4].trim() : "0";
                    String deadlocksStr = parts.length > 5 ? parts[5].trim() : "0";
                    String healthStr = parts.length > 6 ? parts[6].trim() : "OK";

                    map.put("cpuUsage", Double.parseDouble(cpuStr));
                    map.put("memoryUsageMb", Double.parseDouble(memStr));
                    map.put("activeConnections", Integer.parseInt(connStr));
                    map.put("dbSizeMb", Double.parseDouble(dbSizeStr));
                    map.put("deadlocks", Integer.parseInt(deadlocksStr));
                    map.put("sysHealth", healthStr);
                } catch (Exception ex) {
                    // Ensure structural resilience if parsing drops a record
                    map.putIfAbsent("sysHealth", "WARN");
                }
                records.add(map);
            }
        } catch (Exception e) {
            System.err.println("Error reading persistent audit log: " + e.getMessage());
        }
        return records;
    }
}