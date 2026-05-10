# PostgreSQL Monitor

A full-stack performance monitoring dashboard for PostgreSQL databases, featuring real-time hardware tracking, persistent audit logging, and AI-driven query optimization.

## Architecture Overview

The project is built using a decoupled Client-Server architecture:

*   **Backend**: Developed with Spring Boot 3 (Java 17). It handles system metric collection (via Oshi), database interaction (via JDBC), and secure communication with the Groq AI API.
*   **Frontend**: A modern, responsive dashboard built with React 18 and Vite. It utilizes Tailwind CSS for styling, Lucide React for iconography, and i18next for multi-language support (English/Romanian).
*   **Database**: PostgreSQL 15+ with the `pg_stat_statements` extension enabled for deep query analysis.

## Implemented Features

*   **Real-time Dashboard**: Live tracking of CPU usage, RAM allocation, and active database connections.
*   **Enterprise Audit Log**: A persistent CSV-based logging system that records historical metrics, including physical database size on disk and transaction deadlocks.
*   **Performance Bottleneck Identification**: Automatic extraction of the Top 5 most expensive SQL queries based on total execution time.
*   **Schema Insights**: Monitoring of the largest database tables to help with storage management.
*   **Health Status System**: Visual indicators (OK/WARN) based on predefined performance thresholds.
*   **Multilingual Interface**: Seamless toggle between English and Romanian.
*   **Automated Testing**: Full test coverage with JUnit 5/Mockito for the backend and Vitest/React Testing Library for the frontend.

## AI Usage & Integration

This application leverages the Groq AI Engine (using the `llama-3.1-8b-instant` model) to provide two primary intelligent features:

*   **AI System Report**: The backend sends a snapshot of current system metrics to the AI. The model analyzes the data and returns a structured JSON report containing a health summary, identified risks, and actionable recommendations.
*   **Smart Query Explanation**: For any slow query detected, the AI provides a "Plain English" explanation of what the query does and suggests specific optimization tips (e.g., missing indexes or join optimizations).

All AI communications are handled server-side to protect API keys and ensure data privacy.

## Setup Instructions

### Prerequisites

Ensure you have the following installed:

*   Java 17 (JDK)
*   Node.js (v18+)
*   PostgreSQL 15+
*   Groq API Key

### 1. Database Configuration

Enable the statistics extension in your PostgreSQL instance:

```sql
CREATE EXTENSION pg_stat_statements;
```

### 2. Backend Setup

1.  Navigate to the `backend/` folder.
2.  Create a file named `src/main/resources/application-secret.properties`.
3.  Add your credentials:

    ```properties
    spring.datasource.password=your_database_password
    groq.api.key=your_groq_api_key
    ```

4.  Run the application using your IDE (Eclipse/IntelliJ) or via terminal:

    ```bash
    ./mvnw spring-boot:run
    ```

### 3. Frontend Setup

1.  Navigate to the `frontend/` folder.
2.  Install dependencies and start the development server:

    ```bash
    npm install
    npm run dev
    ```

## Running Tests

*   **Backend**: Right-click the `src/test/java` package in Eclipse and select `Run As -> JUnit Test`.
*   **Frontend**: Run `npm run test` in the terminal to execute the Vitest suite.

## Security Note

Files containing sensitive data (`application-secret.properties`, `.env.local`, and `database_metrics.csv`) are explicitly ignored by Git via `.gitignore` to prevent unauthorized access to credentials and private audit logs.
