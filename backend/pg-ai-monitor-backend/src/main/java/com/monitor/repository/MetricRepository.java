package com.monitor.repository;

import com.monitor.model.MetricRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MetricRepository extends JpaRepository<MetricRecord, Long> {
    // spring will automatically write the SQL query for this method based on its name
    List<MetricRecord> findTop10ByOrderByTimestampDesc();
}