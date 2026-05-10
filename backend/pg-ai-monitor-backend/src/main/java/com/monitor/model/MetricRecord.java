package com.monitor.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "metrics_history")
public class MetricRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime timestamp;
    private double cpuUsage;
    private double memoryUsageMb;
    private int activeConnections;
    
    @Column(length = 1000) // give the slow query column more space
    private String slowestQuery;

    // default constructor required by JPA
    public MetricRecord() {}

    public MetricRecord(double cpuUsage, double memoryUsageMb, int activeConnections, String slowestQuery) {
        this.timestamp = LocalDateTime.now();
        this.cpuUsage = cpuUsage;
        this.memoryUsageMb = memoryUsageMb;
        this.activeConnections = activeConnections;
        this.slowestQuery = slowestQuery;
    }

    // Getters
    public Long getId() { return id; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public double getCpuUsage() { return cpuUsage; }
    public double getMemoryUsageMb() { return memoryUsageMb; }
    public int getActiveConnections() { return activeConnections; }
    public String getSlowestQuery() { return slowestQuery; }
}