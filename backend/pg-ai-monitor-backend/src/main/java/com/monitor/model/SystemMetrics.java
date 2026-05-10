package com.monitor.model;

public record SystemMetrics(
        double cpuUsage,
        double memoryUsageMb,
        int activeConnections,
        String slowestQuery
) {}