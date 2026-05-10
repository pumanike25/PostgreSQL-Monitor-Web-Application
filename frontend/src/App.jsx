import React, { useState, useEffect, useRef } from 'react';
import { Activity, Database, Cpu, HardDrive, Loader2, Globe, Clock, AlertTriangle, CheckCircle, XCircle, Maximize2, Minimize2, FileText, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

function App() {
  const { t, i18n } = useTranslation();
  
  const chartRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [metrics, setMetrics] = useState({ cpuUsage: 0, memoryUsageMb: 0, activeConnections: 0, slowestQuery: "N/A" });
  const [historyData, setHistoryData] = useState([]);
  const [aiReport, setAiReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshDelay, setRefreshDelay] = useState(5000);

  const [topQueries, setTopQueries] = useState([]);
  const [health, setHealth] = useState({ database: false, backend: true });
  const [savedCsvRecords, setSavedCsvRecords] = useState([]);
  const [advancedDb, setAdvancedDb] = useState({ deadlocks: 0, dbSizeMb: 0, topTables: [] });

  // AI explenation for every query in the top
  // structure: { 0: { loading: false, data: { whatItDoes: "...", optimizationTip: "..." }, error: null } }
  const [queryExplanations, setQueryExplanations] = useState({});

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ro' : 'en';
    i18n.changeLanguage(newLang);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartRef.current?.requestFullscreen().catch(err => console.error(err.message));
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const fetchLocalCsvAudit = async () => {
      try {
        const response = await axios.get('http://localhost:8080/api/metrics/history');
        setSavedCsvRecords(response.data.slice(-15).reverse());
      } catch (error) {
        console.error("Error loading CSV audit:", error);
      }
    };

    const fetchData = async () => {
      try {
        const [mRes, qRes, hRes] = await Promise.all([
          axios.get(`http://localhost:8080/api/metrics/current`),
          axios.get(`http://localhost:8080/api/metrics/top-queries`),
          axios.get(`http://localhost:8080/api/metrics/health`)
        ]);

        const newData = mRes.data;
        setMetrics(newData);
        setTopQueries(qRes.data);
        setHealth(hRes.data);

        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setHistoryData(prevHistory => {
          const newPoint = {
            time: timeString,
            cpu: Number(newData.cpuUsage.toFixed(2)),
            memory: Number(newData.memoryUsageMb.toFixed(0))
          };
          return [...prevHistory, newPoint].slice(-20);
        });

        fetchLocalCsvAudit();

        // extracting data about deadlocks and disk space in parallel
        try {
          const advRes = await axios.get(`http://localhost:8080/api/metrics/advanced-db`);
          setAdvancedDb(advRes.data);
        } catch (e) { console.error("Advanced DB metrics skip"); }

      } catch (error) {
        setHealth(prev => ({ ...prev, backend: false }));
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, refreshDelay);
    return () => clearInterval(intervalId);
  }, [refreshDelay]);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setAiReport(null);
    try {
      const response = await axios.get(`http://localhost:8080/api/metrics/ai-report?lang=${i18n.language}`);
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      setAiReport(data);
    } catch (error) {
      setAiReport({ error: "Eroare / Error generating report." });
    } finally {
      setIsGenerating(false);
    }
  };

  // call groq for a single query
  const handleExplainSingleQuery = async (sqlString, index) => {
    setQueryExplanations(prev => ({
      ...prev,
      [index]: { loading: true, data: null, error: null }
    }));

    try {
      const response = await axios.post('http://localhost:8080/api/metrics/explain-query', {
        query: sqlString,
        lang: i18n.language
      });
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      
      setQueryExplanations(prev => ({
        ...prev,
        [index]: { loading: false, data: data, error: null }
      }));
    } catch (error) {
      setQueryExplanations(prev => ({
        ...prev,
        [index]: { loading: false, data: null, error: "AI explanation failed." }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              {t('title')}
            </h1>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-gray-500 font-medium">{t('subtitle')}</p>
              <div className="flex space-x-3 border-l pl-4 border-gray-200">
                <StatusIndicator label="DB" online={health.database} />
                <StatusIndicator label="API" online={health.backend} />
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-xl px-3 py-2 shadow-inner border border-gray-200">
              <Clock size={16} className="text-gray-500 mr-2" />
              <select 
                value={refreshDelay}
                onChange={(e) => setRefreshDelay(Number(e.target.value))}
                className="bg-transparent border-none text-gray-800 font-bold focus:outline-none cursor-pointer text-sm"
              >
                <option value={5000}>5 sec</option>
                <option value={10000}>10 sec</option>
                <option value={30000}>30 sec</option>
              </select>
            </div>

            <button onClick={toggleLanguage} className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold transition-colors border border-gray-200">
              <Globe size={18} className="text-blue-500" />
              <span>{i18n.language === 'en' ? 'English' : 'Română'}</span>
            </button>

            <button onClick={handleGenerateAI} disabled={isGenerating} className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50">
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Activity size={20} />}
              <span>{isGenerating ? t('analyzing') : t('genReport')}</span>
            </button>
          </div>
        </header>

        {/* MetricCards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title={t('cpu')} value={`${metrics.cpuUsage.toFixed(2)}%`} icon={<Cpu size={28} />} bg="bg-blue-50" alert={metrics.cpuUsage > 80} />
          <MetricCard title={t('mem')} value={`${metrics.memoryUsageMb.toFixed(0)} MB`} icon={<HardDrive size={28} />} bg="bg-purple-50" alert={metrics.memoryUsageMb > 14000} />
          <MetricCard title={t('conn')} value={metrics.activeConnections} icon={<Database size={28} />} bg="bg-green-50" alert={metrics.activeConnections > 90} />
          <MetricCard 
            title={t('query')} 
            value={metrics.slowestQuery !== "N/A" ? metrics.slowestQuery : t('clean')} 
            icon={<Activity size={28} />} 
            bg="bg-rose-50" 
            isTextSmall={true} 
            isQueryCard={true} 
            hoverTitle={t('hoverQueryTitle')} 
            hoverNote={t('hoverQueryNote')}   
            alert={metrics.slowestQuery !== "N/A" && metrics.slowestQuery !== t('clean')} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Live Graph */}
          <div ref={chartRef} className={`bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col transition-all ${isFullscreen ? 'p-10 bg-white w-full h-full' : 'lg:col-span-2 p-8 h-[550px]'}`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                {t('history')}
                <span className="ml-3 text-xs font-normal text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">Live</span>
              </h2>
              <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors cursor-pointer">
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
            
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#a855f7" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="cpu" name={t('cpu')} stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                  <Line yAxisId="right" type="monotone" dataKey="memory" name={t('mem')} stroke="#a855f7" strokeWidth={3} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Queries */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[550px]">
            <div>
              <h2 className="text-base font-black text-gray-800 mb-1 flex items-center tracking-tight">
                {t('topQueriesTitle')}
              </h2>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                {t('topQueriesDesc')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {topQueries.length > 0 ? topQueries.map((q, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-indigo-100 transition-all">
                  <p className="text-xs font-mono text-gray-700 break-all leading-relaxed" title={q.query}>{q.query}</p>
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-[10px] font-black text-gray-400 uppercase">
                    <div className="flex space-x-2">
                      <span className="bg-white px-2 py-1 rounded border">Calls: {q.calls}</span>
                      <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded border border-rose-100">{q.total_time} ms</span>
                    </div>
                    
                    {/* Individual AI explenation button */}
                    <button 
                      onClick={() => handleExplainSingleQuery(q.query, i)}
                      disabled={queryExplanations[i]?.loading}
                      className="flex items-center space-x-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2 py-1 rounded border border-indigo-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {queryExplanations[i]?.loading ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                      <span>{t('explainBtn')}</span>
                    </button>
                  </div>

                  {/* Groq Answer */}
                  {queryExplanations[i]?.data && (
                    <div className="mt-3 pt-3 border-t border-indigo-100 bg-indigo-50/50 p-3 rounded-lg animate-in fade-in duration-300 text-gray-700 text-xs normal-case tracking-normal font-sans">
                      <p className="font-bold text-indigo-900 mb-1">💡 {t('whatItDoes')}:</p>
                      <p className="mb-2 font-medium leading-relaxed">{queryExplanations[i].data.whatItDoes}</p>
                      <p className="font-bold text-emerald-900 mb-1">⚡ {t('optimizationTip')}:</p>
                      <p className="font-medium text-emerald-800 leading-relaxed">{queryExplanations[i].data.optimizationTip}</p>
                    </div>
                  )}
                  {queryExplanations[i]?.error && (
                    <div className="mt-2 text-[10px] text-red-500 font-sans">{queryExplanations[i].error}</div>
                  )}
                </div>
              )) : (
                <p className="text-gray-400 text-sm text-center mt-10 italic">No data from pg_stat_statements</p>
              )}
            </div>
          </div>
        </div>

        {/* General AI Insights */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <Activity className="mr-2 text-indigo-500" /> {t('aiTitle')}
          </h2>
          {!aiReport && !isGenerating && (
            <div className="h-32 flex items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-medium">
              {t('aiPrompt')}
            </div>
          )}
          {isGenerating && (
            <div className="h-32 flex flex-col items-center justify-center text-indigo-500 space-y-3">
              <Loader2 className="animate-spin" size={36} />
            </div>
          )}
          {aiReport && !isGenerating && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InsightCard title={t('aiHealth')} content={aiReport.healthStatus} color="blue" />
              <InsightCard title={t('aiRisks')} content={aiReport.identifiedRisks} color="amber" />
              <InsightCard title={t('aiRecs')} content={aiReport.recommendations} color="emerald" />
            </div>
          )}
        </div>

        {/* Table size and Transaction Deadlocks */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              {t('storageIntegrityTitle')}
            </h2>
            <p className="text-gray-500 text-sm mt-1">{t('storageIntegrityDesc')}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Row: overall indicator */}
            <div className="flex flex-col justify-between space-y-4">
              
              {/* database size */}
              <div className="relative group p-6 bg-indigo-50/40 rounded-xl border border-indigo-100 flex items-center space-x-4 transition-all hover:bg-indigo-50">
                <div className="p-3 bg-indigo-500 text-white rounded-lg shrink-0">
                  <HardDrive size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{t('totalDbSize')}</p>
                  <p className="text-2xl font-black text-indigo-900 mt-0.5">{advancedDb.dbSizeMb?.toFixed(2)} MB</p>
                </div>

                {/* Toolip Explenatory Hover  */}
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-gray-900 text-white p-3.5 rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none">
                  <p className="text-xs font-bold text-amber-400 uppercase mb-1">{t('hoverDbSizeTitle')}</p>
                  <p className="text-xs text-gray-200 leading-relaxed font-sans normal-case">{t('hoverDbSizeDesc')}</p>
                </div>
              </div>

              {/* Deadlocks */}
              <div className={`relative group p-6 rounded-xl border transition-all ${advancedDb.deadlocks > 0 ? 'bg-rose-500 text-white animate-pulse border-rose-600 shadow-lg shadow-rose-200' : 'bg-emerald-50/40 border-emerald-100 text-gray-800 hover:bg-emerald-50/80'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${advancedDb.deadlocks > 0 ? 'text-rose-100' : 'text-emerald-600'}`}>
                  {t('deadlocksCount')}
                </p>
                <p className={`text-3xl font-black mt-1 ${advancedDb.deadlocks > 0 ? 'text-white' : 'text-emerald-900'}`}>
                  {advancedDb.deadlocks}
                </p>
                <p className={`text-xs mt-2 font-medium truncate ${advancedDb.deadlocks > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                  {advancedDb.deadlocks > 0 ? t('deadlockWarning') : t('deadlockClean')}
                </p>

                {/* Toolip Explenatory Hover  */}
                <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-gray-900 text-white p-3.5 rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none">
                  <p className="text-xs font-bold text-rose-400 uppercase mb-1">{t('hoverDeadlocksTitle')}</p>
                  <p className="text-xs text-gray-200 leading-relaxed font-sans normal-case">{t('hoverDeadlocksDesc')}</p>
                </div>
              </div>

            </div>

            {/* Right Row: Top 5 tables */}
            <div className="relative group lg:col-span-2 border border-gray-100 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:border-indigo-100">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-help">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 text-indigo-900">
                  Top 5 Largest Database Tables
                </span>
                <span className="text-[10px] font-bold bg-white px-2 py-1 rounded border text-gray-400">Includes Indexes</span>
              </div>
              
              <div className="divide-y divide-gray-50 flex-1 overflow-y-auto max-h-56 custom-scrollbar">
                {advancedDb.topTables?.length > 0 ? (
                  advancedDb.topTables.map((table, i) => (
                    <div key={i} className="p-3 px-4 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center space-x-2 truncate pr-4">
                        <span className="text-[10px] font-bold w-4 text-gray-400">{i + 1}.</span>
                        <span className="text-xs font-mono font-bold text-gray-700 truncate">{table.table_name}</span>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="w-16 sm:w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className="bg-indigo-500 h-full rounded-full" 
                            style={{ width: `${(table.size_mb / (advancedDb.topTables[0]?.size_mb || 1)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                          {table.size_mb} MB
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-gray-400 italic">No relations mapped yet</div>
                )}
              </div>

              {/* Toolip Explenatory Hover */}
              <div className="absolute right-0 top-12 mt-1 w-72 sm:w-80 bg-gray-900 text-white p-3.5 rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none text-left">
                <p className="text-xs font-bold text-indigo-400 uppercase mb-1">{t('hoverTopTablesTitle')}</p>
                <p className="text-xs text-gray-200 leading-relaxed font-sans normal-case">{t('hoverTopTablesDesc')}</p>
              </div>
            </div>

          </div>
        </div>

        {/* All-Time stats and CSV */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              {t('allTimeTitle')}
            </h2>
            <p className="text-gray-500 text-sm mt-1">{t('allTimeDesc')}</p>
          </div>

          {/* Global stats done in realtime based on the CSV file */}
          {savedCsvRecords.length > 0 ? (
            (() => {
              const maxCpu = Math.max(...savedCsvRecords.map(r => r.cpuUsage || 0));
              const avgRam = savedCsvRecords.reduce((acc, r) => acc + (r.memoryUsageMb || 0), 0) / savedCsvRecords.length;
              const maxConn = Math.max(...savedCsvRecords.map(r => r.activeConnections || 0));

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{t('peakCpu')}</p>
                    <p className="text-xl font-black text-blue-700 mt-1">{maxCpu.toFixed(2)}%</p>
                  </div>
                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">{t('avgRam')}</p>
                    <p className="text-xl font-black text-purple-700 mt-1">{avgRam.toFixed(0)} MB</p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">{t('peakConns')}</p>
                    <p className="text-xl font-black text-emerald-700 mt-1">{maxConn}</p>
                  </div>
                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{t('totalLogs')}</p>
                    <p className="text-xl font-black text-amber-700 mt-1">{savedCsvRecords.length}</p>
                  </div>
                </div>
              );
            })()
          ) : null}

          {/* Disk History Graph (left) and Latest Entries Table (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Chart showing the evolution of recordings on the disk (DYNAMIC SCALE) */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-64">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('longTermChart')}</p>
              <div className="flex-1 w-full">
                {savedCsvRecords.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...savedCsvRecords].reverse()} margin={{ top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaeaea" />
                      <XAxis dataKey="timestamp" hide />
                      
                      {/* Left axis for CPU (0 - 100 or auto) */}
                      <YAxis yAxisId="cpu" hide domain={['dataMin - 2', 'dataMax + 2']} />
                      
                      {/* Right axis for RAM */}
                      <YAxis yAxisId="ram" orientation="right" hide domain={['dataMin - 10', 'dataMax + 10']} />
                      
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', fontSize: '10px', padding: '6px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} 
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      
                      {/* connect the lines to their separate axes */}
                      <Line yAxisId="cpu" type="monotone" dataKey="cpuUsage" name="CPU" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                      <Line yAxisId="ram" type="monotone" dataKey="memoryUsageMb" name="RAM" stroke="#a855f7" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                    {t('noLocalData')}
                  </div>
                )}
              </div>
            </div>

            {/* Compacted Table with scroll */}
            <div className="overflow-y-auto h-64 border border-gray-100 rounded-xl custom-scrollbar">
              {savedCsvRecords.length > 0 ? (
                <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr className="text-gray-500 text-[9px] uppercase tracking-widest font-bold">
                      <th className="p-2.5 pl-4">{t('timestamp')}</th>
                      <th className="p-2.5">CPU</th>
                      <th className="p-2.5">RAM</th>
                      <th className="p-2.5">{t('conn')}</th>
                      <th className="p-2.5">{t('dbSize')}</th>
                      <th className="p-2.5">{t('deadlocks')}</th>
                      <th className="p-2.5 pr-4 text-center">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-[11px] font-mono">
                    {savedCsvRecords.slice(0, 50).map((record, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-2.5 pl-4 text-gray-500 truncate max-w-[140px]" title={record.timestamp}>
                          {record.timestamp ? record.timestamp.replace("T", " ").substring(0, 19) : `Log #${idx}`}
                        </td>
                        <td className="p-2.5 font-bold text-blue-600">{Number(record.cpuUsage)?.toFixed(1)}%</td>
                        <td className="p-2.5 font-bold text-purple-600">{Number(record.memoryUsageMb)?.toFixed(0)}M</td>
                        <td className="p-2.5 font-bold text-emerald-600">{record.activeConnections || 0}</td>
                        
                        {/* DB Size column */}
                        <td className="p-2.5 font-bold text-indigo-600">
                          {record.dbSizeMb ? `${Number(record.dbSizeMb).toFixed(1)}M` : '-'}
                        </td>
                        
                        {/* Deadlocks column */}
                        <td className="p-2.5 font-bold">
                          {record.deadlocks > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 animate-pulse">
                              {record.deadlocks}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>

                        {/* Health Status column */}
                        <td className="p-2.5 pr-4 text-center font-sans">
                          {record.sysHealth === 'WARN' ? (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                              WARN
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs italic bg-gray-50/30">
                  {t('noLocalData')}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, bg, isTextSmall, alert, isQueryCard, hoverTitle, hoverNote }) {
  return (
    <div className={`relative group p-6 rounded-2xl border transition-all duration-500 flex items-center space-x-5 shadow-sm 
      ${alert ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-white border-gray-100 hover:scale-105'}`}>
      
      <div className={`p-4 rounded-xl shrink-0 ${alert ? 'bg-rose-500 text-white' : bg + ' text-current'}`}>
        {icon}
      </div>
      
      <div className="overflow-hidden w-full">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{title}</p>
        <p className={`${isTextSmall ? 'text-xs font-mono' : 'text-3xl font-black'} truncate ${alert ? 'text-rose-700' : 'text-gray-800'}`}>
          {value}
        </p>
        {alert && (
          <p className="text-[10px] font-black text-rose-500 uppercase mt-1 flex items-center italic">
            <AlertTriangle size={10} className="mr-1" /> Critical Level
          </p>
        )}
      </div>

      {/* Overlay Hover */}
      {isQueryCard && value !== "N/A" && value !== "Clean" && value !== "Curat (Fără interogări lente)" && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-gray-900 text-white p-4 rounded-xl shadow-2xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none">
          <p className="text-xs font-bold text-amber-400 uppercase mb-1">{hoverTitle}</p>
          <p className="text-xs font-mono break-all whitespace-pre-wrap leading-relaxed">{value}</p>
          <p className="text-[10px] text-gray-400 mt-2 italic">{hoverNote}</p>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ label, online }) {
  return (
    <div className="flex items-center space-x-1">
      {online ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
      <span className={`text-[10px] font-black uppercase ${online ? 'text-green-600' : 'text-red-600'}`}>{label}</span>
    </div>
  );
}

function InsightCard({ title, content, color }) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
  };
  return (
    <div className={`p-6 rounded-xl border ${colorMap[color]} shadow-sm transition-all hover:shadow-md`}>
      <h3 className="font-bold mb-3 uppercase tracking-wider text-xs opacity-70">{title}</h3>
      <p className="text-sm leading-relaxed font-medium">{content}</p>
    </div>
  );
}

export default App;