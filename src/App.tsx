import { TrendingUp, ShieldCheck, Activity, BarChart3, Database, ChevronRight, CheckCircle2, RotateCcw, FileDown, LogIn, LogOut, FileClock, Trash2, Home, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import * as htmlToImage from 'html-to-image';
import jsPDF from 'jspdf';
import { analyzeTables } from './lib/geminiService';
import { AnalysisResult, SystemStatus } from './types';
import { auth, db, signInWithGoogle, logout, collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, serverTimestamp } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export default function App() {
  const [status, setStatus] = useState<SystemStatus | 'history'>('initial');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [numTables, setNumTables] = useState<number | null>(null);
  const [tablesReceived, setTablesReceived] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(1);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'reports'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(docs);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (status === 'history' && user) {
      loadHistory();
    }
  }, [status, user]);

  // --- Initial Step ---
  const handleStart = (count: number) => {
    setNumTables(count);
    setStatus('collecting');
    setCurrentIndex(1);
  };

  // --- Collection Step ---
  const handleAddTable = useCallback((tableText: string) => {
    setTablesReceived((prev) => [...prev, tableText]);
    
    if (currentIndex < (numTables || 0)) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setStatus('complete');
    }
  }, [currentIndex, numTables]);

  // --- Analysis Step ---
  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analyzeTables(tablesReceived);
      setAnalysisResult(result);
      setStatus('analysed');
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReport = async () => {
    if (!user || !analysisResult) return;
    setSaving(true);
    try {
      // Find asset symbol from analysis result (looking at first call)
      const assetSymbol = analysisResult.calls[0]?.symbol.substring(0, 4) || "OPCOES";
      
      await addDoc(collection(db, 'reports'), {
        userId: user.uid,
        timestamp: serverTimestamp(),
        assetSymbol: assetSymbol,
        description: `Análise RTF-SCA - ${assetSymbol}`,
        data: analysisResult
      });
      alert("Relatório salvo com sucesso no banco de dados!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Falha ao salvar relatório.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm("Deseja excluir este relatório permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'reports', id));
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const handleViewReport = (report: any) => {
    setAnalysisResult(report.data);
    setStatus('analysed');
  };

  const handleReset = () => {
    setStatus('initial');
    setNumTables(null);
    setTablesReceived([]);
    setCurrentIndex(1);
    setAnalysisResult(null);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    
    try {
      const element = reportRef.current;
      
      // html-to-image is much better with modern CSS colors (oklab/oklch)
      const dataUrl = await htmlToImage.toPng(element, {
        backgroundColor: '#0a0a0b',
        quality: 1.0,
        pixelRatio: 2,
        filter: (node) => {
          // Ignore buttons and action elements
          if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === 'true') {
            return false;
          }
          return true;
        }
      });
      
      const img = new Image();
      img.src = dataUrl;
      
      img.onload = () => {
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [img.width, img.height]
        });
        
        pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
        pdf.save(`Relatorio_RTF_SCA_${new Date().toISOString().split('T')[0]}.pdf`);
        setExporting(false);
      };
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-main font-sans selection:bg-accent-gold/30">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-green/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border-dim">
          <div className="flex items-center gap-4">
            <div 
              className="p-3 bg-bg-surface border border-border-dim rounded-lg shadow-xl shadow-black/40 cursor-pointer hover:border-accent-gold/40 transition-all"
              onClick={() => setStatus('initial')}
            >
              <TrendingUp className="w-8 h-8 text-accent-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-serif italic text-accent-gold tracking-tight cursor-pointer" onClick={() => setStatus('initial')}>
                RTF-SCA Analyst Pro
              </h1>
              <p className="text-text-dim text-[10px] mt-1 uppercase tracking-widest font-bold">Terminal de Derivativos de Alta Precisão</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-6 px-6 py-3 bg-bg-surface border border-border-dim rounded-lg h-[54px]">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-accent-green shadow-[0_0_8px_rgba(0,230,118,0.5)]" />
                 <span className="text-[10px] uppercase tracking-widest font-bold text-text-dim">Status: {status === 'initial' ? 'Pronto' : status === 'history' ? 'Histórico' : 'Ativo'}</span>
               </div>
               <div className="w-px h-4 bg-border-dim" />
               <button 
                onClick={() => setStatus('history')}
                className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-all ${status === 'history' ? 'text-accent-gold' : 'text-text-dim hover:text-white'}`}
               >
                 <FileClock className="w-4 h-4" /> Histórico
               </button>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3 bg-bg-surface border border-border-dim pl-4 pr-2 py-2 rounded-lg h-[54px]">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-white uppercase tracking-tighter truncate max-w-[100px]">{user.displayName || 'Usuário'}</span>
                    <button onClick={logout} className="text-[9px] text-red-400 uppercase font-black hover:text-red-300">Sair</button>
                  </div>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-border-dim" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-bg-deep border border-border-dim flex items-center justify-center text-accent-gold font-bold">
                       {user.displayName?.charAt(0) || <User className="w-4 h-4" />}
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 px-6 py-0 h-[54px] bg-white text-black rounded font-bold text-[11px] uppercase tracking-widest hover:bg-white/90 transition-all shadow-lg"
                >
                  <LogIn className="w-4 h-4" /> Entrar com Google
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-[60vh]">
          <AnimatePresence mode="wait">
            {status === 'initial' && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto text-center py-20"
              >
                <h2 className="text-4xl md:text-5xl font-serif italic text-white mb-6 leading-tight">
                  Quantas tabelas você deseja <br /><span className="text-accent-gold underline underline-offset-8 decoration-border-dim">inserir para análise?</span>
                </h2>
                <div className="bg-bg-surface border border-border-dim rounded-lg p-10 shadow-2xl">
                   <p className="text-xs text-text-dim mb-8 font-bold uppercase tracking-[0.3em]">Selecione a quantidade de datasets</p>
                   <div className="flex flex-wrap justify-center gap-4">
                     {[1, 2, 3, 4, 5].map((n) => (
                       <button
                         key={n}
                         onClick={() => handleStart(n)}
                         className="w-16 h-16 rounded bg-bg-deep border border-border-dim text-accent-gold font-serif italic text-2xl hover:bg-accent-gold hover:text-black hover:scale-105 transition-all active:scale-95 flex items-center justify-center"
                       >
                         {n}
                       </button>
                     ))}
                   </div>
                </div>
              </motion.div>
            )}

            {status === 'collecting' && (
              <motion.div
                key="collecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8"
              >
                <aside className="space-y-6">
                  <div className="bg-bg-surface/50 border border-border-dim rounded-lg p-6 space-y-4">
                    <div className="bg-bg-surface border border-border-dim p-4 rounded text-sm text-text-main animate-pulse">
                      Envie a Tabela {currentIndex} para processamento RTF-SCA.
                    </div>
                    {tablesReceived.map((_, i) => (
                      <div key={i} className="bg-accent-gold p-3 rounded text-black text-xs font-bold self-end shadow-lg shadow-accent-gold/10 flex items-center justify-between">
                        <span>Tabela {i+1} Recebida</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    ))}
                    <div className="mt-8 bg-black border border-dashed border-border-dim p-4 text-[10px] font-mono text-text-dim space-y-1">
                      <p className="text-accent-gold uppercase tracking-widest font-bold mb-2">// ESTADO INTERNO</p>
                      <p>numero_tabelas: {numTables}</p>
                      <p>tabelas_recebidas: {tablesReceived.length}</p>
                      <p>status: {status}</p>
                      <p>indice_atual: {currentIndex}</p>
                    </div>
                  </div>
                </aside>

                <div className="space-y-6">
                  <div className="bg-bg-surface border border-border-dim rounded-lg p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Database className="w-24 h-24" />
                    </div>
                    <label className="block text-xs font-bold text-text-dim uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-accent-gold rounded-full" /> Dataset {currentIndex} Input
                    </label>
                    <textarea
                      autoFocus
                      placeholder="Cole aqui os dados da tabela (Texto, CSV ou formatado)..."
                      className="w-full h-80 bg-bg-deep border border-border-dim rounded p-6 text-text-main font-mono text-sm focus:outline-none focus:border-accent-gold/40 transition-colors resize-none placeholder-text-dim/30"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          const val = (e.target as HTMLTextAreaElement).value;
                          if (val.trim()) {
                            handleAddTable(val);
                            (e.target as HTMLTextAreaElement).value = '';
                          }
                        }
                      }}
                    />
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-[10px] text-text-dim uppercase tracking-widest">Pressione <kbd className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10">CTRL + ENTER</kbd></span>
                      <button 
                        onClick={() => {
                          const ta = document.querySelector('textarea');
                          if (ta && ta.value.trim()) {
                            handleAddTable(ta.value);
                            ta.value = '';
                          }
                        }}
                        className="px-8 py-3 bg-accent-gold text-black font-bold rounded hover:bg-[#b08e4d] transition-colors flex items-center gap-2 uppercase text-xs tracking-widest"
                      >
                        Registrar <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {status === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-xl mx-auto text-center py-20"
              >
                <div className="w-20 h-20 bg-accent-green/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-accent-green/20">
                  <CheckCircle2 className="w-10 h-10 text-accent-green" />
                </div>
                <h3 className="text-3xl font-serif italic text-white mb-4">Coleta Finalizada</h3>
                <p className="text-text-dim text-sm mb-12 uppercase tracking-wide">
                  Os {numTables} pacotes de dados foram sincronizados com sucesso.
                </p>
                <button
                  disabled={loading}
                  onClick={handleAnalyze}
                  className={`w-full py-5 rounded bg-accent-gold text-black font-bold text-sm uppercase tracking-[0.3em] hover:bg-[#b08e4d] transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Executar Análise Profissional'
                  )}
                </button>
              </motion.div>
            )}

            {status === 'analysed' && analysisResult && (
              <motion.div
                key="analysed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                ref={reportRef}
                className="space-y-16 pb-24 px-4 bg-bg-deep"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-dim pb-8 gap-4 no-print">
                  <div>
                    <h2 className="text-4xl font-serif italic text-accent-gold tracking-tight">Dashboard de Resultados</h2>
                    <p className="text-text-dim font-mono text-xs mt-2 uppercase tracking-[0.3em]">Análise Consolidada RTF-SCA</p>
                  </div>
                  <div className="flex items-center gap-3" data-html2canvas-ignore="true">
                    {user && (
                      <button 
                        onClick={handleSaveReport}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-bg-surface border border-border-dim rounded text-[10px] uppercase font-bold tracking-widest text-white hover:border-accent-gold/40 transition-all shadow-lg disabled:opacity-50"
                      >
                        {saving ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Database className="w-4 h-4 text-accent-gold" />
                        )}
                        Salvar no Banco
                      </button>
                    )}
                    <button 
                      onClick={handleExportPDF}
                      disabled={exporting}
                      className="flex items-center gap-2 px-6 py-2 bg-accent-gold text-black rounded text-[10px] uppercase font-bold tracking-widest hover:bg-[#b08e4d] transition-all shadow-lg disabled:opacity-50"
                    >
                      {exporting ? (
                        <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Exportar PDF
                    </button>
                    <button 
                      onClick={handleReset}
                      className="flex items-center gap-2 px-6 py-2 bg-bg-surface border border-border-dim rounded text-[10px] uppercase font-bold tracking-widest text-text-dim hover:text-white hover:border-accent-gold/40 transition-all shadow-lg"
                    >
                      <RotateCcw className="w-4 h-4" /> Reiniciar
                    </button>
                  </div>
                </div>

                {/* Section 1: CALLS */}
                <Section title="🟢 Venda de Call (Income Strategy)" icon={<TrendingUp className="w-5 h-5 text-accent-green" />}>
                   <DataTable data={analysisResult.calls} type="option" />
                </Section>

                {/* Section 2: PUTS */}
                <Section title="🔵 Venda de Put (Discount Entry)" icon={<ShieldCheck className="w-5 h-5 text-blue-400" />}>
                   <DataTable data={analysisResult.puts} type="option" />
                </Section>

                {/* Section 3: STRANGLE */}
                <Section title="🟣 Strangle (Market Neutral)" icon={<Activity className="w-5 h-5 text-purple-400" />}>
                   <DataTable data={analysisResult.strangle} type="strangle" />
                </Section>

                {/* Bottom Row Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
                  {/* Greeks Panel */}
                  <div className="bg-bg-surface border border-border-dim rounded-lg p-8 shadow-2xl">
                     <h4 className="text-lg font-serif italic text-accent-gold mb-8 flex items-center gap-3">
                        <BarChart3 className="w-5 h-5" /> Análise das Gregas (Consolidado)
                     </h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <GreekCard label="Delta" sub="Direcionalidade" value={analysisResult.greeks.delta} />
                        <GreekCard label="Gamma" sub="Sensibilidade" value={analysisResult.greeks.gamma} />
                        <GreekCard label="Theta" sub="Renda Diária" value={analysisResult.greeks.theta} />
                        <GreekCard label="Vega" sub="Cenário Vol" value={analysisResult.greeks.vega} />
                     </div>
                     <div className="mt-8 pt-8 border-t border-border-dim space-y-4">
                        <InfoItem label="Projeção de Payoff" value={analysisResult.payoff.interpretation} />
                        <div className="grid grid-cols-2 gap-4">
                           <InfoCard label="Break-Even Superior" value={`R$ ${analysisResult.payoff.breakEvenUpper.toFixed(2)}`} />
                           <InfoCard label="Break-Even Inferior" value={`R$ ${analysisResult.payoff.breakEvenLower.toFixed(2)}`} />
                        </div>
                     </div>
                  </div>

                  {/* Conclusion Panel */}
                  <div className="bg-bg-surface border border-border-dim rounded-lg p-8 flex flex-col shadow-2xl">
                    <h4 className="text-lg font-serif italic text-accent-gold mb-8 flex items-center gap-3">
                       <CheckCircle2 className="w-5 h-5" /> Conclusão RTF
                    </h4>
                    <div className="space-y-6 flex-1">
                       <RecommendationItem label="Melhor Estratégia Call" value={analysisResult.conclusion.bestCall} />
                       <RecommendationItem label="Melhor Estratégia Put" value={analysisResult.conclusion.bestPut} />
                       <RecommendationItem label="Delta Neutro (Strangle)" value={analysisResult.conclusion.bestStrangle} />
                    </div>
                    
                    <div className="mt-12 pt-8 border-t border-border-dim">
                       <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] uppercase font-bold text-text-dim tracking-widest">Perfil de Risco Sugerido</span>
                          <span className={`px-4 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                            analysisResult.conclusion.profileIndication === 'Conservador' ? 'bg-[#1b3320] text-accent-green' :
                            analysisResult.conclusion.profileIndication === 'Moderado' ? 'bg-[#332b1b] text-accent-gold' : 'bg-red-900/30 text-red-500'
                          }`}>
                            {analysisResult.conclusion.profileIndication}
                          </span>
                       </div>
                       <p className="text-[11px] leading-relaxed text-text-dim italic">
                          {analysisResult.conclusion.assetComparison || "Análise baseada em dados de mercado atualizados. Priorize a consistência do Theta positivo."}
                       </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {status === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8 max-w-5xl mx-auto"
              >
                <div className="flex items-center justify-between border-b border-border-dim pb-6">
                  <div>
                    <h2 className="text-3xl font-serif italic text-accent-gold">Histórico de Análises</h2>
                    <p className="text-text-dim text-[10px] uppercase tracking-[0.3em] font-bold mt-1">Seus relatórios salvos no Banco de Dados</p>
                  </div>
                  <button onClick={() => setStatus('initial')} className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-dim rounded text-[10px] uppercase font-bold text-text-dim hover:text-white">
                    <Home className="w-4 h-4" /> Voltar ao Início
                  </button>
                </div>

                {!user ? (
                  <div className="text-center py-20 bg-bg-surface border border-border-dim rounded-lg">
                    <User className="w-12 h-12 text-text-dim mx-auto mb-4 opacity-20" />
                    <p className="text-text-dim text-sm uppercase tracking-widest">Faça login para ver seu histórico</p>
                    <button onClick={signInWithGoogle} className="mt-6 px-8 py-3 bg-accent-gold text-black font-bold rounded uppercase text-[10px] tracking-widest">Entrar agora</button>
                  </div>
                ) : loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-10 h-10 border-4 border-accent-gold border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-text-dim">Sincronizando Dados...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-20 bg-bg-surface border border-border-dim rounded-lg">
                    <FileClock className="w-12 h-12 text-text-dim mx-auto mb-4 opacity-20" />
                    <p className="text-text-dim text-sm uppercase tracking-widest font-bold">Nenhum relatório salvo ainda</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {history.map((report) => (
                      <div key={report.id} className="group bg-bg-surface border border-border-dim p-6 rounded-lg hover:border-accent-gold/30 transition-all shadow-xl">
                        <div className="flex items-start justify-between mb-6">
                          <div className="p-2 bg-bg-deep rounded border border-border-dim">
                             <TrendingUp className="w-5 h-5 text-accent-gold" />
                          </div>
                          <span className="text-[9px] font-mono text-text-dim bg-black px-2 py-1 rounded">
                            {report.timestamp?.toDate ? report.timestamp.toDate().toLocaleDateString('pt-BR') : 'Sem data'}
                          </span>
                        </div>
                        <h4 className="text-lg font-serif italic text-white mb-2">{report.description}</h4>
                        <p className="text-[10px] text-text-dim uppercase tracking-widest font-bold mb-8">Ativo: {report.assetSymbol}</p>
                        
                        <div className="flex items-center gap-3 pt-6 border-t border-border-dim">
                          <button 
                            onClick={() => handleViewReport(report)}
                            className="flex-1 px-4 py-2 bg-accent-gold text-black font-bold text-[10px] uppercase tracking-widest rounded hover:bg-[#b08e4d] transition-colors"
                          >
                            Visualizar
                          </button>
                          <button 
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-2 bg-red-900/10 text-red-500 rounded border border-red-900/20 hover:bg-red-900/20 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Section({ title, children, icon }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-xl font-serif italic text-accent-gold tracking-tighter">{title}</h3>
      </div>
      <div className="bg-bg-surface border border-border-dim rounded overflow-hidden shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function DataTable({ data, type }: { data: any[], type: 'option' | 'strangle' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-base">
        <thead>
          <tr className="bg-[#1a1a1d] border-b border-border-dim">
            <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">Risco</th>
            <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">{type === 'option' ? 'Opção' : 'Estratégia'}</th>
            {type === 'option' && <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">Strike</th>}
            <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">{type === 'option' ? 'Prêmio (BID)' : 'Receita Total'}</th>
            {type === 'option' && <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">Min (2%)</th>}
            <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">{type === 'option' ? 'Liq. Estimado' : 'Lucro Líquido'}</th>
            <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">Retorno</th>
            {type === 'option' && <th className="p-4 uppercase tracking-widest text-text-dim font-bold text-xs">Prob. ITM</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-dim">
          {data.map((item, i) => (
            <tr key={i} className="hover:bg-bg-deep/50 transition-colors font-mono">
              <td className="p-4">
                <span className={`text-xs font-black uppercase tracking-widest ${
                   item.risk.toLowerCase().includes('baixo') || item.risk.toLowerCase().includes('verde') || item.risk.toLowerCase().includes('conservador') || item.risk === 'Low' ? 'text-accent-green' :
                   item.risk.toLowerCase().includes('médio') || item.risk.toLowerCase().includes('amarelo') || item.risk.toLowerCase().includes('moderado') || item.risk === 'Medium' ? 'text-accent-gold' : 'text-red-500'
                }`}>
                  {item.risk
                    .replace(/[🟢🟡🔴]/g, '')
                    .replace(/\(.*\)/g, '')
                    .replace(/verde|amarelo|vermelho/gi, '')
                    .trim()}
                </span>
              </td>
              <td className="p-4 font-bold text-text-main uppercase tracking-widest">{type === 'option' ? item.symbol : item.strategy}</td>
              {type === 'option' && <td className="p-4 text-text-dim">R$ {item.strike.toFixed(2)}</td>}
              <td className="p-4 text-accent-gold font-bold">
                R$ {(type === 'option' ? item.premium : item.grossRevenueTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
              {type === 'option' && <td className="p-4 text-text-dim/60 font-medium whitespace-nowrap">R$ {item.minPremium2Percent.toFixed(2)}</td>}
              <td className="p-4 text-text-main">
                R$ {(type === 'option' ? item.netProfit : item.netProfit).toLocaleString()}
              </td>
              <td className="p-4">
                <span className="text-accent-green font-bold">
                  {item.returnPercent.toFixed(2)}%
                </span>
              </td>
              {type === 'option' && (
                <td className="p-4 text-text-dim">
                   {(item.exerciseProbability * 100).toFixed(1)}%
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GreekCard({ label, sub, value }: { label: string, sub: string, value: string }) {
  return (
    <div className="bg-bg-deep border border-border-dim p-4 flex flex-col items-center justify-center text-center">
      <span className="text-[16px] font-mono font-bold text-accent-gold">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-text-dim opacity-60 mt-1">{label}</span>
      <span className="text-[8px] uppercase tracking-tighter text-text-dim/40">{sub}</span>
    </div>
  );
}

function RecommendationItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase font-bold text-text-dim tracking-widest block mb-2">{label}</span>
      <p className="text-sm font-mono font-bold text-text-main border-l-2 border-accent-gold pl-4 py-1">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase font-bold text-text-dim tracking-widest block mb-1">{label}</span>
      <p className="text-text-main text-xs leading-relaxed font-mono">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-bg-deep rounded border border-border-dim p-4">
       <span className="text-[9px] uppercase font-bold text-text-dim tracking-widest block mb-1">{label}</span>
       <p className="text-base font-mono font-bold text-accent-gold">{value}</p>
    </div>
  );
}

