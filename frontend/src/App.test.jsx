import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import './i18n'; // Initialize the real dictionary

// --- ULTRA-ROBUST MOCK API ---
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn((url) => {
        if (url.includes('/current')) {
          return Promise.resolve({ 
            data: { 
              cpuUsage: 45.5, 
              memoryUsageMb: 8192, 
              activeConnections: 12, 
              slowestQuery: "SELECT * FROM massive_table" 
            } 
          });
        }
        if (url.includes('/top-queries')) {
          return Promise.resolve({ 
            data: [
              { query: "SELECT * FROM heavy_join", total_time: 350.5, calls: 100 }
            ] 
          });
        }
        if (url.includes('/health')) {
          return Promise.resolve({ data: { database: true, backend: true } });
        }
        if (url.includes('/history')) {
          return Promise.resolve({ 
            data: [
              { timestamp: "2026-05-10 12:00:00", cpuUsage: 10.0, memoryUsageMb: 2048, activeConnections: 5 }
            ] 
          });
        }
        if (url.includes('/advanced-db')) {
          return Promise.resolve({ 
            data: { deadlocks: 0, dbSizeMb: 1024.75, topTables: [] } 
          });
        }
        if (url.includes('/ai-report')) {
          return Promise.resolve({ 
            data: { 
              healthStatus: "System operating normally", 
              identifiedRisks: "None", 
              recommendations: "Keep monitoring" 
            } 
          });
        }
        return Promise.resolve({ data: {} });
      }),
      post: vi.fn(() => {
        return Promise.resolve({ 
          data: { 
            whatItDoes: "Scans multiple rows", 
            optimizationTip: "Add a composite index" 
          } 
        });
      })
    }
  };
});

describe('PostgreSQL AI Monitor - Frontend Test Suite', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- TEST 1: BASIC RENDERING ---
  it('renders main titles and mock backend metrics correctly', async () => {
    render(<App />);

    // Search for the title ignoring any formatting or emojis
    expect(await screen.findByText(/PostgreSQL AI Monitor/i)).toBeInTheDocument();
    expect(await screen.findByText(/45.50%/i)).toBeInTheDocument();
    expect(await screen.findByText(/8192/i)).toBeInTheDocument();
  });

  // --- TEST 2: LANGUAGE TOGGLE ---
  it('toggles language between English and Romanian on button click', async () => {
    render(<App />);

    // Find the button using flexible text matching (ignoring emojis)
    const langButton = await screen.findByRole('button', { name: /English/i });
    expect(langButton).toBeInTheDocument();

    fireEvent.click(langButton);

    // Verify the language changes to Romanian
    expect(await screen.findByRole('button', { name: /Română/i })).toBeInTheDocument();
  });

  // --- TEST 3: CSV AUDIT ---
  it('renders persistent CSV audit data in the local storage log table', async () => {
    render(<App />);

    // Partially search for the word Audit, completely decoupled from emojis
    expect(await screen.findByText(/Audit/i)).toBeInTheDocument();
    expect(await screen.findByText("2026-05-10 12:00:00")).toBeInTheDocument();
  });

  // --- TEST 4: AI REPORT GENERATION ---
  it('triggers AI report generation and displays insights', async () => {
    render(<App />);

    // Find the AI button flexibly
    const generateBtn = await screen.findByRole('button', { name: /Generate AI Report|Generează Raport AI/i });
    expect(generateBtn).toBeInTheDocument();

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText(/System operating normally/i)).toBeInTheDocument();
    });
  });

  // --- TEST 5: INDIVIDUAL EXPLAIN AI ---
  it('triggers Explain AI for individual top queries and shows accordion details', async () => {
    render(<App />);

    // Wait for the table row to appear
    expect(await screen.findByText("SELECT * FROM heavy_join")).toBeInTheDocument();

    // Find the small Explain AI button
    const explainBtn = await screen.findByRole('button', { name: /Explain AI|Explică AI/i });
    expect(explainBtn).toBeInTheDocument();

    fireEvent.click(explainBtn);

    await waitFor(() => {
      expect(screen.getByText(/Add a composite index/i)).toBeInTheDocument();
    });
  });

});