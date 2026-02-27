import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Play, 
  Square, 
  Search, 
  HelpCircle, 
  Settings, 
  X, 
  Save, 
  RotateCcw, 
  FileText, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Download,
  Info,
  Database,
  Bug
} from 'lucide-react';
import { EntityType, EntityResult, ApiProvider, OntologyType, SessionState } from './types';
import { fetchEntityInfo } from './services/geminiService';
import { generateAndDownloadCsv } from './utils/csvHelper';

type AnalysisPhase = 'idle' | 'initial' | 'deep_search_pending' | 'deep_searching' | 'complete';
type AppTab = 'setup' | 'execution' | 'results';

// --- UI Components ---

const ResultsTable: React.FC<{ results: EntityResult[] }> = ({ results }) => {
    if (results.length === 0) return null;
    
    const hasOntology = results.some(r => r["Ontology Term"] || r["Ontology ID"]);
    const headers = ["Input", "Resolved", "Type", ...(hasOntology ? ["Ontology Term"] : []), "ID & Links", "Time (s)", "Status"];
    
    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                    Detailed Results
                </h3>
                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
                    {results.length} Entities Processed
                </span>
            </div>
            <div className="overflow-hidden bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {headers.map(header => (
                                    <th key={header} scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {results.map((result, index) => {
                                const identifiers = [
                                    { id: result["UniProt"], link: result["UniProt Link"], label: "UniProt" },
                                    { id: result["RefSeq"], link: result["RefSeq Link"], label: "RefSeq" },
                                    { id: result["Ensembl"], link: result["Ensembl Link"], label: "Ensembl" },
                                    { id: result["InterPro"], link: result["InterPro Link"], label: "InterPro" },
                                    { id: result["PubChem CID"], link: result["PubChem Link"], label: "PubChem" },
                                    { id: result["ChEMBL ID"], link: result["ChEMBL Link"], label: "ChEMBL" },
                                    { id: result["KEGG"], link: result["KEGG Link"], label: "KEGG" },
                                    { id: result["Ontology ID"], link: null, label: "Ontology" },
                                ].filter(item => item.id);

                                return (
                                    <tr key={`${result["Input Entity"]}-${index}`} className="hover:bg-slate-50 transition-colors duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{result["Input Entity"]}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{result["Resolved Name"] || '—'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                                result["Entity Type"] === 'chemical' ? 'bg-emerald-100 text-emerald-700' :
                                                result["Entity Type"] === 'protein' ? 'bg-blue-100 text-blue-700' :
                                                result["Entity Type"] === 'gene' ? 'bg-purple-100 text-purple-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {result["Entity Type"] || 'Unknown'}
                                            </span>
                                        </td>
                                        {hasOntology && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {(result["Ontology Term"] || result["Ontology ID"]) ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{result["Ontology Term"] || '—'}</span>
                                                        <span className="text-xs text-slate-400 font-mono">{result["Ontology ID"] || '—'}</span>
                                                    </div>
                                                ) : '—'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex flex-wrap gap-2 max-w-[300px]">
                                                {identifiers.length > 0 ? identifiers.map((item, idx) => (
                                                    <div key={idx} className="flex items-center bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1.5">{item.label}:</span>
                                                        {item.link ? (
                                                            <a 
                                                                href={item.link} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-indigo-600 hover:text-indigo-800 font-mono font-medium hover:underline flex items-center"
                                                            >
                                                                {item.id}
                                                                <Download className="h-2.5 w-2.5 ml-0.5 rotate-[-90deg]" />
                                                            </a>
                                                        ) : (
                                                            <span className="font-mono text-slate-600">{item.id}</span>
                                                        )}
                                                    </div>
                                                )) : <span className="text-slate-400">—</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{result["Processing Time (s)"]?.toFixed(2) ?? '—'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {result["Validation Issues"] ? (
                                                <div className="flex items-center text-amber-600">
                                                    <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
                                                    <span className="truncate max-w-[150px]">{result["Validation Issues"]}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center text-emerald-600">
                                                    <CheckCircle2 className="h-4 w-4 mr-1 flex-shrink-0" />
                                                    <span>Resolved</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const VisualizationDashboard: React.FC<{ results: EntityResult[] }> = ({ results }) => {
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (results.length > 0 && chartRef.current) {
            const typeCounts = results.reduce((acc, result) => {
                const type = result["Entity Type"] || 'Unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {} as { [key: string]: number });

            const data = [{
                values: Object.values(typeCounts),
                labels: Object.keys(typeCounts),
                type: 'pie',
                hole: .4,
                hoverinfo: 'label+percent',
                textinfo: 'value',
                automargin: true,
                marker: {
                    colors: ['#10b981', '#3b82f6', '#8b5cf6', '#64748b', '#f59e0b']
                }
            }];

            const layout = {
                title: {
                    text: 'Entity Type Distribution',
                    font: { family: 'Inter, sans-serif', size: 16, weight: 600 }
                },
                showlegend: true,
                height: 400,
                margin: { t: 50, b: 50, l: 50, r: 50 },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
            };

            (window as any).Plotly.newPlot(chartRef.current, data, layout, {responsive: true, displayModeBar: false});
        }
    }, [results]);

    if (results.length === 0) return null;

    return (
        <div className="mt-8">
             <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                Data Insights
             </h3>
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div ref={chartRef} className="w-full"></div>
             </div>
        </div>
    );
};


const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4" 
        onClick={onClose}
    >
        <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" 
            onClick={e => e.stopPropagation()}
        >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <HelpCircle className="h-6 w-6 mr-2 text-indigo-600" />
                    User Documentation
                </h2>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
                <section>
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm mr-3">1</span>
                        Configuration & Setup
                    </h3>
                    <div className="pl-11 space-y-3 text-slate-600 leading-relaxed">
                        <p><strong className="text-slate-800">Integration:</strong> Connect your preferred computational model. For Gemini, the system uses the environment key by default if left blank.</p>
                        <p><strong className="text-slate-800">Ontology Mapping:</strong> Select specialized databases like ChEBI or Gene Ontology to enrich the resolution process with domain-specific IDs.</p>
                        <p><strong className="text-slate-800">Data Ingestion:</strong> Upload a plain text file or paste entities directly into the editor.</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm mr-3">2</span>
                        Analysis Execution
                    </h3>
                    <div className="pl-11 space-y-3 text-slate-600 leading-relaxed">
                        <p><strong className="text-slate-800">Real-time Monitoring:</strong> Watch the processing queue in the Execution tab. The system provides live logs and a progress indicator.</p>
                        <p><strong className="text-slate-800">Deep Search:</strong> For ambiguous or obscure entities, use the Deep Search feature which employs advanced reasoning to scour multiple databases.</p>
                    </div>
                </section>

                <section>
                    <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center">
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm mr-3">3</span>
                        Results & Export
                    </h3>
                    <div className="pl-11 space-y-3 text-slate-600 leading-relaxed">
                        <p><strong className="text-slate-800">Visualization:</strong> Analyze the distribution of your entity types through interactive charts.</p>
                        <p><strong className="text-slate-800">CSV Export:</strong> The system automatically generates a comprehensive CSV report including all identifiers and links upon completion.</p>
                    </div>
                </section>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                    Got it, thanks!
                </button>
            </div>
        </motion.div>
    </motion.div>
);

const ApiKeyStatus: React.FC<{ provider: ApiProvider; apiKey: string }> = ({ provider, apiKey }) => {
    if (apiKey) return <span className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" /> User Key Active</span>;
    if (provider === 'Gemini') return <span className="px-3 py-1 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full flex items-center"><Database className="h-3 w-3 mr-1" /> Environment Default</span>;
    return <span className="px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-full flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Key Required</span>;
};

const SESSION_STORAGE_KEY = 'bioIdAiSession';

const App: React.FC = () => {
    // State management
    const [entityList, setEntityList] = useState<string[]>([]);
    const [entityType, setEntityType] = useState<EntityType>("Auto");
    const [backgroundInfo, setBackgroundInfo] = useState('');
    const [ontology, setOntology] = useState<OntologyType>("None");
    const [enableOntology, setEnableOntology] = useState(false);
    const [logs, setLogs] = useState<string[]>(["System initialized. Awaiting data configuration..."]);
    const [progress, setProgress] = useState(0);
    const [totalForProgress, setTotalForProgress] = useState(0);
    const [results, setResults] = useState<EntityResult[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
    const [textAreaContent, setTextAreaContent] = useState('');
    const [apiProvider, setApiProvider] = useState<ApiProvider>('Gemini');
    const [apiKey, setApiKey] = useState('');
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<AppTab>('setup');

    const runningRef = useRef(false);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const apiProviders: ApiProvider[] = ["Gemini", "OpenAI", "Groq", "Anthropic", "Cohere", "Mistral AI", "Perplexity", "Together AI"];
    const ontologies: OntologyType[] = ["None", "Gene Ontology", "ChEBI", "MeSH"];

    // Effects
    useEffect(() => {
        if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }, [logs]);

    // Callbacks and handlers
    const addLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    }, []);
    
    const handleSaveSession = () => {
        try {
            const sessionState: SessionState = {
                entityList, entityType, backgroundInfo, ontology, results, logs,
                analysisPhase, apiProvider, enableOntology, textAreaContent, fileName
            };
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
            addLog("Session state persisted to local storage.");
        } catch (error) {
            addLog("Persistence failed. Storage might be restricted.");
            console.error("Failed to save session:", error);
        }
    };
    
    const handleLoadSession = () => {
        try {
            const savedStateJSON = localStorage.getItem(SESSION_STORAGE_KEY);
            if (savedStateJSON) {
                const savedState: SessionState = JSON.parse(savedStateJSON);
                setEntityList(savedState.entityList);
                setEntityType(savedState.entityType);
                setBackgroundInfo(savedState.backgroundInfo);
                setOntology(savedState.ontology);
                setEnableOntology(savedState.enableOntology || false);
                setResults(savedState.results);
                setLogs(savedState.logs);
                setAnalysisPhase(savedState.analysisPhase as AnalysisPhase);
                setApiProvider(savedState.apiProvider);
                setTextAreaContent(savedState.textAreaContent);
                setFileName(savedState.fileName);
                addLog("Previous session restored successfully.");
            } else {
                addLog("No existing session found.");
            }
        } catch (error) {
            addLog("Restoration failed. Data might be corrupted.");
            console.error("Failed to load session:", error);
        }
    };

    const handleReset = () => {
        if (confirm("Are you sure you want to clear all data and results? This will reset the current analysis session.")) {
            setResults([]);
            setProgress(0);
            setTotalForProgress(0);
            setAnalysisPhase('idle');
            setLogs(["System reset. Ready for new analysis."]);
            setActiveTab('setup');
            runningRef.current = false;
            addLog("System state has been reset.");
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                setEntityList(lines);
                setFileName(file.name);
                setTextAreaContent('');
                addLog(`Imported ${lines.length} entities from ${file.name}`);
            };
            reader.readAsText(file);
            event.target.value = '';
        }
    };
    
    const handleTextAreaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const content = event.target.value;
        setTextAreaContent(content);
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        setEntityList(lines);
        if (lines.length > 0) setFileName('');
    };
    
    const handleStop = () => {
        runningRef.current = false;
        addLog("Termination signal sent. Finalizing pending request...");
    };

    const processEntity = async (entity: string, isDeepSearch: boolean) => {
        const startTime = performance.now();
        const apiResponse = await fetchEntityInfo(apiProvider, apiKey, entity, entityType, backgroundInfo, ontology, isDeepSearch, enableOntology);
        const endTime = performance.now();
        
        const result: EntityResult = {
            "Input Entity": entity,
            "Refined Entity Name": apiResponse.corrected_name !== entity ? apiResponse.corrected_name : "",
            "Entity Type": apiResponse.entity_type,
            "Resolved Name": apiResponse.resolved_name,
            "Validation Issues": apiResponse.validation_issues.join('; '),
            "Pathways": apiResponse.pathways.join('; '),
            "Function": apiResponse.biological_function.join('; '),
            "Cellular Component": apiResponse.cellular_component.join('; '),
            "Ontology ID": apiResponse.ontology_id || (apiResponse.identifiers as any)?.["Ontology ID"],
            "Ontology Term": apiResponse.ontology_term || (apiResponse.identifiers as any)?.["Ontology Term"],
            // Explicitly map identifiers to ensure they are captured at the top level for CSV export
            "PubChem CID": apiResponse.identifiers?.["PubChem CID"],
            "ChEMBL ID": apiResponse.identifiers?.["ChEMBL ID"],
            "KEGG": apiResponse.identifiers?.["KEGG"],
            "UniProt": apiResponse.identifiers?.["UniProt"],
            "RefSeq": apiResponse.identifiers?.["RefSeq"],
            "Ensembl": apiResponse.identifiers?.["Ensembl"],
            "InterPro": apiResponse.identifiers?.["InterPro"],
            "InChIKey": apiResponse.identifiers?.["InChIKey"],
            "SMILES": apiResponse.identifiers?.["SMILES"],
            // Explicitly map links
            "PubChem Link": apiResponse.links?.["PubChem Link"],
            "ChEMBL Link": apiResponse.links?.["ChEMBL Link"],
            "KEGG Link": apiResponse.links?.["KEGG Link"],
            "UniProt Link": apiResponse.links?.["UniProt Link"],
            "RefSeq Link": apiResponse.links?.["RefSeq Link"],
            "Ensembl Link": apiResponse.links?.["Ensembl Link"],
            "InterPro Link": apiResponse.links?.["InterPro Link"],
            "Processing Time (s)": (endTime - startTime) / 1000,
        };
        return result;
    };

    const runAnalysis = async (list: string[], isDeepSearch: boolean) => {
        const currentResults = isDeepSearch ? [...results] : [];
        setTotalForProgress(list.length);
        let totalTime = 0;
        
        // Parallel processing with controlled concurrency for speed
        const CONCURRENCY = 3;
        const chunks = [];
        for (let i = 0; i < list.length; i += CONCURRENCY) {
            chunks.push(list.slice(i, i + CONCURRENCY));
        }

        for (let i = 0; i < chunks.length; i++) {
            if (!runningRef.current) { addLog(`Execution aborted by user.`); break; }
            const chunk = chunks[i];
            
            const chunkPromises = chunk.map(async (entity, idx) => {
                const globalIdx = i * CONCURRENCY + idx;
                addLog(`${isDeepSearch ? "Deep Search" : "Resolving"} (${globalIdx + 1}/${list.length}): ${entity}`);
                
                try {
                    const result = await processEntity(entity, isDeepSearch);
                    totalTime += result["Processing Time (s)"] || 0;
                    return { entity, result, success: true };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Network or Provider error.";
                    addLog(`Failed '${entity}': ${errorMessage}`);
                    return { entity, error: errorMessage, success: false };
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            
            for (const res of chunkResults) {
                if (res.success && res.result) {
                    if (isDeepSearch) {
                        const resultIndex = currentResults.findIndex(r => r["Input Entity"] === res.entity);
                        if(resultIndex !== -1) currentResults[resultIndex] = res.result;
                    } else {
                        currentResults.push(res.result);
                    }
                    addLog(`Success: ${res.entity} resolved to ${res.result["Resolved Name"] || 'Unknown'}`);
                } else if (!isDeepSearch) {
                    currentResults.push({ "Input Entity": res.entity, "Validation Issues": `Resolution error: ${res.error}` } as EntityResult);
                }
            }

            setResults([...currentResults]);
            setProgress(Math.min(list.length, (i + 1) * CONCURRENCY));

            // Small delay between batches to avoid rate limits
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
        
        const resolvedCount = currentResults.filter(r => !r["Validation Issues"]).length;
        addLog(`--- Analysis Cycle Complete ---`);
        addLog(`Metrics: ${resolvedCount}/${list.length} resolved (${((resolvedCount / list.length) * 100 || 0).toFixed(1)}%)`);
        addLog(`Performance: Avg ${(totalTime / list.length || 0).toFixed(2)}s per entity`);
        
        return currentResults;
    }

    const handleStart = async () => {
        if (entityList.length === 0) { addLog("Error: Input list is empty."); return; }
        if (apiProvider !== 'Gemini' && !apiKey) { addLog(`Error: API credentials missing for ${apiProvider}.`); return; }
        
        setActiveTab('execution');
        setAnalysisPhase('initial');
        runningRef.current = true;
        setResults([]);
        setProgress(0);
        
        addLog(`--- Initiating Analysis: ${entityList.length} entities via ${apiProvider} ---`);
        const newResults = await runAnalysis(entityList, false);
        
        const failedEntities = newResults.filter(r => r["Validation Issues"]);
        if (failedEntities.length > 0 && runningRef.current) {
            setAnalysisPhase('deep_search_pending');
            addLog(`${failedEntities.length} entities require Deep Search.`);
        } else {
            setAnalysisPhase('complete');
            addLog("Analysis finalized successfully.");
        }
        runningRef.current = false;
        if (analysisPhase !== 'deep_search_pending') setActiveTab('results');
    };

    const handleDeepSearch = async () => {
        const failedEntitiesList = results.filter(r => r["Validation Issues"]).map(r => r["Input Entity"]);
        if (failedEntitiesList.length === 0) { addLog("No targets for Deep Search."); return; }
        
        setActiveTab('execution');
        setAnalysisPhase('deep_searching');
        runningRef.current = true;
        setProgress(0);
        
        addLog(`--- Initiating Deep Search: ${failedEntitiesList.length} entities ---`);
        await runAnalysis(failedEntitiesList, true);
        
        setAnalysisPhase('complete');
        runningRef.current = false;
        setActiveTab('results');
    };

    const handleManualExport = () => {
        if (results.length === 0) {
            addLog("Error: No results to export.");
            return;
        }
        const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        generateAndDownloadCsv(results, `bioid-manual-export-${runId}.csv`);
        addLog(`Manual export generated: bioid-manual-export-${runId}.csv`);
    };

    const downloadDebugReport = async () => {
        addLog("Generating debug report...");
        try {
            let debugData = { status: "unavailable", error: "Fetch failed" };
            try {
                const debugResponse = await fetch('/api/debug');
                if (debugResponse.ok) {
                    debugData = await debugResponse.json();
                } else {
                    debugData = { status: "error", error: `HTTP ${debugResponse.status}` };
                }
            } catch (e) {
                console.warn("Could not reach debug endpoint", e);
            }
            
            const report = {
                timestamp: new Date().toISOString(),
                app_version: "4.5.0-PRO",
                client_logs: logs,
                server_debug: debugData,
                browser_info: {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform
                },
                current_config: {
                    provider: apiProvider,
                    entityType,
                    ontology,
                    enableOntology
                }
            };

            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bioid-debug-report-${new Date().getTime()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addLog("Debug report downloaded. Please share this with the developer.");
        } catch (error) {
            addLog(`Error generating debug report: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Fallback: download logs at least
            const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bioid-logs-fallback-${new Date().getTime()}.txt`;
            a.click();
        }
    };

    const isProcessing = analysisPhase === 'initial' || analysisPhase === 'deep_searching';
    const failedCount = results.filter(r => r["Validation Issues"]).length;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <AnimatePresence>
                {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                    <div className="flex items-center space-x-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                            <Database className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">BioIdentifier Pro</h1>
                            <p className="text-slate-500 font-medium">Precision Biological & Chemical Entity Resolution</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button 
                            onClick={handleReset}
                            className="flex items-center px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            New Analysis
                        </button>
                        <button 
                            onClick={() => setIsHelpOpen(true)}
                            className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
                        >
                            <HelpCircle className="h-6 w-6" />
                        </button>
                    </div>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Sidebar Navigation */}
                    <nav className="lg:col-span-3 space-y-2">
                        {[
                            { id: 'setup', label: '1. Configuration', icon: Settings },
                            { id: 'execution', label: '2. Execution', icon: Play },
                            { id: 'results', label: '3. Results', icon: BarChart3 },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as AppTab)}
                                className={`w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-2xl transition-all ${
                                    activeTab === tab.id 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                    : 'text-slate-500 hover:bg-white hover:text-slate-800'
                                }`}
                            >
                                <tab.icon className={`h-5 w-5 mr-3 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
                                {tab.label}
                                {activeTab === tab.id && <ChevronRight className="ml-auto h-4 w-4 opacity-50" />}
                            </button>
                        ))}

                        <div className="mt-8 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Session Info</h4>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Active Provider</p>
                                    <p className="text-sm font-bold text-slate-700">{apiProvider}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-1">Status</p>
                                    <ApiKeyStatus provider={apiProvider} apiKey={apiKey} />
                                </div>
                                <div className="pt-2 flex space-x-2">
                                    <button onClick={handleSaveSession} className="flex-1 p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Save Session">
                                        <Save className="h-4 w-4 mx-auto" />
                                    </button>
                                    <button onClick={handleLoadSession} className="flex-1 p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Load Session">
                                        <Download className="h-4 w-4 mx-auto" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </nav>

                    {/* Main Content Area */}
                    <div className="lg:col-span-9">
                        <AnimatePresence mode="wait">
                            {/* Setup Tab Content */}
                            {activeTab === 'setup' && (
                                <motion.div
                                    key="setup"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-8"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                            <h3 className="text-lg font-bold text-slate-800 flex items-center">
                                                <Settings className="h-5 w-5 mr-2 text-indigo-600" />
                                                API Configuration
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Provider</label>
                                                    <select 
                                                        value={apiProvider} 
                                                        onChange={e => setApiProvider(e.target.value as ApiProvider)}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                                                    >
                                                        {apiProviders.map(p => <option key={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">API Key</label>
                                                    <input 
                                                        type="password" 
                                                        value={apiKey} 
                                                        onChange={e => setApiKey(e.target.value)}
                                                        placeholder={apiProvider === 'Gemini' ? 'Using environment key...' : 'Enter credentials'}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-slate-100 space-y-4">
                                                <h4 className="text-sm font-bold text-slate-800">Search Parameters</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Type Hint</label>
                                                        <select 
                                                            value={entityType} 
                                                            onChange={e => setEntityType(e.target.value as EntityType)}
                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                                                        >
                                                            <option>Auto</option><option>Chemical</option><option>Protein</option><option>Gene</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ontology</label>
                                                        <select 
                                                            value={ontology} 
                                                            onChange={e => setOntology(e.target.value as OntologyType)}
                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                                                        >
                                                            {ontologies.map(o => <option key={o}>{o}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                {ontology !== 'None' && (
                                                    <div className="flex items-center space-x-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                        <input 
                                                            type="checkbox"
                                                            id="enableOntology"
                                                            checked={enableOntology}
                                                            onChange={e => setEnableOntology(e.target.checked)}
                                                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                        <div className="flex-grow">
                                                            <label htmlFor="enableOntology" className="text-sm font-bold text-indigo-900 cursor-pointer block">
                                                                Enrich with {ontology}
                                                            </label>
                                                            <p className="text-[10px] text-indigo-600 leading-tight">
                                                                Uses deep search & grounding. Slower but more accurate.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contextual Info</label>
                                                    <textarea 
                                                        rows={3} 
                                                        value={backgroundInfo} 
                                                        onChange={e => setBackgroundInfo(e.target.value)}
                                                        placeholder="Optional biological context..."
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                                                <Upload className="h-5 w-5 mr-2 text-indigo-600" />
                                                Data Ingestion
                                            </h3>
                                            <div className="flex-grow flex flex-col">
                                                <div className="relative group flex-grow flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50 hover:bg-white hover:border-indigo-300 transition-all cursor-pointer">
                                                    <input 
                                                        type="file" 
                                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                                        accept=".txt" 
                                                        onChange={handleFileChange} 
                                                    />
                                                    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                                        <Upload className="h-8 w-8 text-indigo-600" />
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700">Drop .txt file here</p>
                                                    <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                                                </div>

                                                <div className="my-6 flex items-center">
                                                    <div className="flex-grow h-px bg-slate-100"></div>
                                                    <span className="px-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Manual Entry</span>
                                                    <div className="flex-grow h-px bg-slate-100"></div>
                                                </div>

                                                <textarea 
                                                    rows={6} 
                                                    value={textAreaContent} 
                                                    onChange={handleTextAreaChange}
                                                    placeholder="Paste entity names (one per line)..."
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                                                />
                                                
                                                <div className="mt-4 flex items-center justify-between">
                                                    <div className="flex items-center text-xs font-bold text-slate-400">
                                                        <FileText className="h-3 w-3 mr-1.5" />
                                                        {entityList.length} Entities Loaded
                                                    </div>
                                                    {fileName && (
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-bold truncate max-w-[150px]">
                                                            {fileName}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Prominent Run Button in Setup Tab */}
                                    <div className="flex justify-center pt-4">
                                        <button
                                            onClick={handleStart}
                                            disabled={entityList.length === 0 || isProcessing}
                                            className="group relative flex items-center px-10 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all disabled:bg-slate-300 disabled:shadow-none disabled:translate-y-0"
                                        >
                                            <Play className="h-5 w-5 mr-3 fill-current" />
                                            Initialize Analysis
                                            <ChevronRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Execution Tab Content */}
                            {activeTab === 'execution' && (
                                <motion.div
                                    key="execution"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="space-y-8"
                                >
                                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-bold text-slate-800">Processing Pipeline</h3>
                                                <p className="text-slate-500 font-medium">Monitoring real-time entity resolution</p>
                                            </div>
                                            <div className="flex space-x-3">
                                                {!isProcessing ? (
                                                    <button 
                                                        onClick={handleStart} 
                                                        disabled={entityList.length === 0 || analysisPhase === 'complete'} 
                                                        className="flex items-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:bg-slate-200 disabled:shadow-none"
                                                    >
                                                        <Play className="h-5 w-5 mr-2 fill-current" />
                                                        Start Analysis
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={handleStop} 
                                                        className="flex items-center px-6 py-3 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                                                    >
                                                        <Square className="h-5 w-5 mr-2 fill-current" />
                                                        Stop Pipeline
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Progress Section */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <div className="flex items-center space-x-3">
                                                    <div className={`p-2 rounded-lg ${isProcessing ? 'bg-indigo-100 animate-pulse' : 'bg-slate-100'}`}>
                                                        <Search className={`h-5 w-5 ${isProcessing ? 'text-indigo-600' : 'text-slate-400'}`} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700">
                                                            {isProcessing ? 'Active Processing...' : analysisPhase === 'complete' ? 'Analysis Complete' : 'Idle'}
                                                        </p>
                                                        <p className="text-xs text-slate-400 font-medium">
                                                            {progress} of {totalForProgress || entityList.length} entities
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-2xl font-black text-indigo-600">
                                                    {Math.round((progress / (totalForProgress || 1)) * 100)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                                                <motion.div 
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(progress / (totalForProgress || 1)) * 100}%` }}
                                                    className="bg-indigo-600 h-full rounded-full shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                                                />
                                            </div>
                                        </div>

                                        {/* Deep Search Callout */}
                                        {analysisPhase === 'deep_search_pending' && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-center gap-6"
                                            >
                                                <div className="bg-white p-3 rounded-xl shadow-sm">
                                                    <Search className="h-8 w-8 text-amber-500" />
                                                </div>
                                                <div className="flex-grow text-center md:text-left">
                                                    <h4 className="text-lg font-bold text-amber-900">Deep Search Recommended</h4>
                                                    <p className="text-sm text-amber-700 font-medium">{failedCount} entities could not be resolved with standard methods. Run intensive search?</p>
                                                </div>
                                                <button 
                                                    onClick={handleDeepSearch} 
                                                    className="w-full md:w-auto px-8 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-100"
                                                >
                                                    Start Deep Search
                                                </button>
                                            </motion.div>
                                        )}

                                        {/* Console Logs */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Console</h4>
                                                <span className="flex items-center text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
                                                    Live Output
                                                </span>
                                            </div>
                                            <div 
                                                ref={logContainerRef} 
                                                className="bg-slate-900 text-indigo-300 font-mono text-[13px] rounded-2xl p-6 h-80 overflow-y-auto shadow-inner border border-slate-800 custom-scrollbar"
                                            >
                                                {logs.map((log, i) => (
                                                    <div key={i} className="mb-1.5 flex">
                                                        <span className="text-slate-600 mr-3 select-none">{(i + 1).toString().padStart(3, '0')}</span>
                                                        <p className="whitespace-pre-wrap leading-relaxed">{log}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Results Tab Content */}
                            {activeTab === 'results' && (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="space-y-8"
                                >
                                    {results.length > 0 ? (
                                        <div className="space-y-12">
                                            {/* Summary Stats */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {[
                                                    { label: 'Total Entities', value: results.length, icon: FileText, color: 'indigo' },
                                                    { label: 'Resolved', value: results.filter(r => !r["Validation Issues"]).length, icon: CheckCircle2, color: 'emerald' },
                                                    { label: 'Issues Found', value: results.filter(r => r["Validation Issues"]).length, icon: AlertCircle, color: 'amber' },
                                                    { label: 'Avg Time', value: `${(results.reduce((acc, r) => acc + (r["Processing Time (s)"] || 0), 0) / results.length).toFixed(2)}s`, icon: Play, color: 'blue' },
                                                ].map((stat, i) => (
                                                    <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
                                                        <div className={`p-3 rounded-xl bg-${stat.color}-50 text-${stat.color}-600`}>
                                                            <stat.icon className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                                                            <p className="text-xl font-black text-slate-800">{stat.value}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <ResultsTable results={results} />
                                            <div className="flex justify-center mt-8">
                                                <button 
                                                    onClick={handleManualExport}
                                                    className="flex items-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                                >
                                                    <Download className="h-5 w-5 mr-2" />
                                                    Export Results to CSV
                                                </button>
                                            </div>
                                            <VisualizationDashboard results={results} />

                                            {/* Post-Analysis Actions */}
                                            <div className="pt-8 border-t border-slate-200 flex flex-col items-center space-y-4">
                                                <p className="text-slate-500 font-medium">Analysis complete. What would you like to do next?</p>
                                                <div className="flex flex-wrap justify-center gap-4">
                                                    <button 
                                                        onClick={() => generateAndDownloadCsv(results, `bioid-export-${new Date().getTime()}.csv`)}
                                                        className="flex items-center px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                                                    >
                                                        <Download className="h-5 w-5 mr-2" />
                                                        Download CSV
                                                    </button>
                                                    <button 
                                                        onClick={handleReset}
                                                        className="flex items-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                                    >
                                                        <RotateCcw className="h-5 w-5 mr-2" />
                                                        Start New Analysis
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center space-y-6">
                                            <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
                                                <BarChart3 className="h-12 w-12 text-slate-300" />
                                            </div>
                                            <div className="max-w-md mx-auto">
                                                <h3 className="text-2xl font-bold text-slate-800">No Data Available</h3>
                                                <p className="text-slate-500 mt-2 font-medium">Configure your entity list and run the resolution pipeline to see results and visualizations here.</p>
                                            </div>
                                            <button 
                                                onClick={() => setActiveTab('setup')}
                                                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                            >
                                                Go to Configuration
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>

                <footer className="mt-20 pt-8 border-t border-slate-200 text-center">
                    <div className="flex flex-col items-center space-y-2">
                        <div className="flex items-center justify-center space-x-2 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">
                            <Database className="h-3 w-3" />
                            <span>BioIdentifier Pro</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span>v4.5.0-PRO</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                            Developed by Khabat Vahabi | IGZ & SSP
                        </div>
                        <button 
                            onClick={downloadDebugReport}
                            className="mt-4 text-[10px] text-slate-400 hover:text-indigo-500 transition-colors flex items-center space-x-1 uppercase tracking-tighter font-bold"
                        >
                            <Bug className="h-3 w-3" />
                            <span>Generate Debug Report</span>
                        </button>
                    </div>
                </footer>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #475569;
                }
            `}</style>
        </div>
    );
};

export default App;
