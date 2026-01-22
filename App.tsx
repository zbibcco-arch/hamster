
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Layout from './components/Layout';
import { ContentCategory, ShortsConcept, VisualMode } from './types';
import { 
  getConceptRecommendations, 
  generateBackgroundImage, 
  generateSpeech,
  decodeBase64,
  decodeAudioData
} from './services/geminiService';

interface SavedConcept extends ShortsConcept {
  savedAt: number;
  category: ContentCategory;
}

const App: React.FC = () => {
  const [category, setCategory] = useState<ContentCategory>('QUOTES');
  const [visualMode, setVisualMode] = useState<VisualMode>('REALISTIC');
  const [philosopherName, setPhilosopherName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<ShortsConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<ShortsConcept | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [savedConcepts, setSavedConcepts] = useState<SavedConcept[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Load saved concepts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('shortsmind_saved');
    if (stored) {
      try {
        setSavedConcepts(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved concepts", e);
      }
    }
  }, []);

  // Save to localStorage whenever savedConcepts changes
  useEffect(() => {
    localStorage.setItem('shortsmind_saved', JSON.stringify(savedConcepts));
  }, [savedConcepts]);

  const westernPhilosophers = [
    { name: '소크라테스', desc: '질문과 깨달음' },
    { name: '니체', desc: '초인과 극복' },
    { name: '세네카', desc: '스토아 철학' },
    { name: '아우렐리우스', desc: '명상록' },
    { name: '쇼펜하우어', desc: '현실적인 위로' },
    { name: '데카르트', desc: '이성과 존재' },
  ];

  const easternPhilosophers = [
    { name: '공자', desc: '예절과 배움' },
    { name: '노자', desc: '무위자연과 비움' },
    { name: '장자', desc: '자유로운 영혼' },
    { name: '맹자', desc: '인의와 본성' },
    { name: '부처', desc: '마음의 평화' },
    { name: '이황', desc: '수양과 덕목' },
  ];

  const handleRecommend = async () => {
    if (!keywords.trim() && (category === 'SELF_IMPROVEMENT' || !philosopherName.trim())) {
      alert("인물 이름이나 키워드를 입력해주세요.");
      return;
    }
    setLoading(true);
    setConcepts([]);
    setSelectedConcept(null);
    setPreviewImage(null);
    setShowSaved(false);
    try {
      const result = await getConceptRecommendations(category, keywords, visualMode, philosopherName);
      setConcepts(result.concepts);
    } catch (error) {
      console.error(error);
      alert("추천 로딩 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConcept = useCallback(async (concept: ShortsConcept) => {
    setSelectedConcept(concept);
    setPreviewImage(null);
    setImageLoading(true);
    try {
      const img = await generateBackgroundImage(concept.visualScenes[0]?.prompt || concept.title, visualMode);
      setPreviewImage(img);
    } catch (err) {
      console.error(err);
    } finally {
      setImageLoading(false);
    }
  }, [visualMode]);

  const handleGenerateAudio = async () => {
    if (!selectedConcept) return;
    setAudioLoading(true);
    try {
      const data = await generateSpeech(selectedConcept.hook, category === 'QUOTES' ? 'Kore' : 'Puck');
      if (data) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        const decodedBytes = decodeBase64(data);
        const audioBuffer = await decodeAudioData(decodedBytes, ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (err) {
      console.error("Audio playback error:", err);
      alert("오디오 생성 중 오류가 발생했습니다.");
    } finally {
      setAudioLoading(false);
    }
  };

  const copyCaptions = () => {
    if (!selectedConcept) return;
    const captions = selectedConcept.detailedScript
      .split('\n')
      .filter(l => l.includes('[자막]'))
      .map(l => {
        const parts = l.split('[자막]');
        return parts.length > 1 ? parts[1].trim().replace(/^"|"$/g, '') : '';
      })
      .filter(Boolean)
      .join('\n');
    
    if (!captions) {
      alert("대본에서 추출할 자막이 없습니다.");
      return;
    }
    
    navigator.clipboard.writeText(captions);
    alert("자막(Caption) 텍스트만 추출하여 복사되었습니다.");
  };

  const handleSaveConcept = () => {
    if (!selectedConcept) return;
    
    // Check if already saved
    if (savedConcepts.find(c => c.id === selectedConcept.id)) {
      alert("이미 저장된 컨셉입니다.");
      return;
    }

    const newSaved: SavedConcept = {
      ...selectedConcept,
      savedAt: Date.now(),
      category: category
    };
    
    setSavedConcepts([newSaved, ...savedConcepts]);
    alert("라이브러리에 저장되었습니다.");
  };

  const handleDeleteSaved = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("정말 삭제하시겠습니까?")) {
      setSavedConcepts(savedConcepts.filter(c => c.id !== id));
      if (selectedConcept?.id === id) {
        setSelectedConcept(null);
        setPreviewImage(null);
      }
    }
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input and List */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <div className="bg-red-50 p-2 rounded-xl">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                숏츠 설정
              </h2>
              <button 
                onClick={() => setShowSaved(!showSaved)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all ${showSaved ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <svg className="w-4 h-4" fill={showSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                라이브러리 ({savedConcepts.length})
              </button>
            </div>
            
            {!showSaved ? (
              <div className="animate-in fade-in duration-300">
                <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setCategory('QUOTES')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${category === 'QUOTES' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    명언/지혜
                  </button>
                  <button 
                    onClick={() => setCategory('SELF_IMPROVEMENT')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${category === 'SELF_IMPROVEMENT' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    자기계발
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-700 ml-1">비주얼 스타일</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: 'REALISTIC', label: '실사', icon: '📸' },
                        { id: 'ANIMATION', label: '애니메이션', icon: '🎨' },
                        { id: 'OIL_PAINTING', label: '유화', icon: '🖼️' },
                        { id: 'ORIENTAL_PAINTING', label: '동양화', icon: '🖌️' }
                      ].map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setVisualMode(style.id as VisualMode)}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${visualMode === style.id ? 'border-red-500 bg-red-50' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                        >
                          <span className="text-2xl mb-1">{style.icon}</span>
                          <span className={`text-xs font-black ${visualMode === style.id ? 'text-red-600' : 'text-slate-500'}`}>{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {category === 'QUOTES' && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="space-y-2">
                          <label className="block text-sm font-bold text-slate-700 ml-1">등장 인물 (철학가/위인)</label>
                          <input 
                            type="text"
                            placeholder="이름을 직접 입력하거나 아래 추천 목록에서 선택하세요"
                            value={philosopherName}
                            onChange={(e) => setPhilosopherName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none font-medium focus:ring-4 focus:ring-red-500/5 transition-all shadow-inner"
                          />
                        </div>
                        
                        <div className="space-y-5">
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> 인기 서양 철학가
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {westernPhilosophers.map(p => (
                                <button 
                                  key={p.name}
                                  onClick={() => setPhilosopherName(p.name)}
                                  className={`px-4 py-2 rounded-full border text-[11px] font-bold transition-all shadow-sm ${philosopherName === p.name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'}`}
                                >
                                  {p.name} <span className={`ml-1 font-normal opacity-50 ${philosopherName === p.name ? 'text-white' : 'text-slate-400'}`}>| {p.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> 인기 동양 철학가
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {easternPhilosophers.map(p => (
                                <button 
                                  key={p.name}
                                  onClick={() => setPhilosopherName(p.name)}
                                  className={`px-4 py-2 rounded-full border text-[11px] font-bold transition-all shadow-sm ${philosopherName === p.name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300'}`}
                                >
                                  {p.name} <span className={`ml-1 font-normal opacity-50 ${philosopherName === p.name ? 'text-white' : 'text-slate-400'}`}>| {p.desc}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 ml-1">주제 및 키워드</label>
                      <input 
                        type="text"
                        placeholder="예: 현대인에게 주는 위로, 도파민 중독 탈출..."
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none font-medium focus:ring-4 focus:ring-red-500/5 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleRecommend}
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-5 rounded-[1.5rem] transition-all disabled:opacity-50 text-lg shadow-xl shadow-red-200/50"
                  >
                    {loading ? "전략 분석 중..." : "컨셉 생성하기"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="mb-6 flex items-center justify-between">
                   <p className="text-slate-400 text-xs font-bold">저장된 컨셉들을 클릭하여 다시 불러올 수 있습니다.</p>
                   {savedConcepts.length > 0 && (
                     <button 
                      onClick={() => { if(confirm("전체 라이브러리를 비우시겠습니까?")) setSavedConcepts([]) }}
                      className="text-red-500 text-[10px] font-black underline"
                     >전체 삭제</button>
                   )}
                </div>
                {savedConcepts.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {savedConcepts.map((sc) => (
                      <div 
                        key={sc.id}
                        onClick={() => {
                          setCategory(sc.category);
                          handleSelectConcept(sc);
                        }}
                        className={`p-5 rounded-2xl border-2 group relative transition-all cursor-pointer ${selectedConcept?.id === sc.id ? 'border-red-500 bg-red-50' : 'bg-white border-slate-50 hover:border-slate-200'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${sc.category === 'QUOTES' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                            {sc.category === 'QUOTES' ? '명언' : '자기계발'}
                          </span>
                          <button 
                            onClick={(e) => handleDeleteSaved(e, sc.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 leading-tight mb-1">{sc.title}</h4>
                        <p className="text-slate-400 text-[10px] font-medium">{new Date(sc.savedAt).toLocaleDateString()} 저장됨</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                    </div>
                    <p className="text-slate-400 font-bold text-sm leading-relaxed">아직 저장된 컨셉이 없습니다.<br/>마음에 드는 컨셉을 라이브러리에 담아보세요.</p>
                  </div>
                )}
                <button 
                  onClick={() => setShowSaved(false)}
                  className="w-full mt-6 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm"
                >
                  새로운 컨셉 생성하러 가기
                </button>
              </div>
            )}
          </section>

          {!showSaved && concepts.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-black text-slate-900 px-4">추천된 컨셉 목록</h3>
              {concepts.map((concept, idx) => (
                <div 
                  key={concept.id || idx}
                  onClick={() => handleSelectConcept(concept)}
                  className={`p-6 rounded-[2.2rem] border-2 cursor-pointer transition-all ${selectedConcept?.id === concept.id ? 'border-red-500 bg-red-50 ring-4 ring-red-50' : 'bg-white border-transparent shadow-sm hover:shadow-md'}`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="bg-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase">IDEA {idx + 1}</span>
                    <span className="text-[10px] font-bold text-slate-400">🎯 {concept.targetAudience}</span>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 mb-2">{concept.title}</h4>
                  <p className="text-slate-600 text-sm italic">"{concept.hook}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Preview and Detail */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {selectedConcept ? (
            <div className="sticky top-8 space-y-6">
              {/* Phone Preview Mockup */}
              <div className="mx-auto w-[280px] h-[500px] bg-slate-900 rounded-[3rem] p-3 shadow-2xl relative overflow-hidden border-[8px] border-slate-800">
                <div className="absolute inset-0">
                  {imageLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 p-6 text-center">
                      <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-white text-[10px] font-black uppercase tracking-widest">Image Generating...</p>
                    </div>
                  ) : previewImage ? (
                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="w-full h-full bg-slate-800"></div>
                  )}
                </div>
                
                <div className="absolute inset-0 p-6 flex flex-col justify-end text-white bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none">
                  <div className="mb-4">
                    <p className="text-[9px] font-black bg-red-600 inline-block px-2 py-0.5 rounded-md mb-2 uppercase tracking-tighter">Viral Hook Preview</p>
                    <p className="text-md font-black leading-tight drop-shadow-lg">{selectedConcept.hook}</p>
                  </div>
                </div>

                {/* Overlaid Actions */}
                <div className="absolute top-6 left-6 right-6 flex flex-col gap-2">
                   <button 
                    onClick={(e) => { e.stopPropagation(); handleGenerateAudio(); }}
                    disabled={audioLoading}
                    className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold py-3 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                   >
                    {audioLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        목소리 생성 중...
                      </span>
                    ) : (
                      <>🔊 AI 나레이션 미리듣기</>
                    )}
                   </button>
                </div>
              </div>

              {/* Detail Info Card */}
              <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">제작 리소스 및 전략</h5>
                    <button 
                      onClick={handleSaveConcept}
                      className={`p-2 rounded-full transition-all ${savedConcepts.find(c => c.id === selectedConcept.id) ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      title="저장하기"
                    >
                      <svg className="w-5 h-5" fill={savedConcepts.find(c => c.id === selectedConcept.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                    </button>
                  </div>
                  <button 
                    onClick={copyCaptions} 
                    className="group bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-4 py-2 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-blue-100"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    자막만 복사하기
                  </button>
                </div>

                <div className="px-8 pb-8 mt-6 space-y-8">
                  <div>
                    <h5 className="text-[11px] font-black text-slate-400 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span> 숏츠 전략 대본 (Script)
                    </h5>
                    <div className="p-5 bg-slate-900 rounded-[1.5rem] text-white font-mono text-[10px] leading-loose max-h-[300px] overflow-y-auto border-4 border-slate-800">
                       {selectedConcept.detailedScript.split('\n').map((line, i) => (
                         <p key={i} className={line.includes('[자막]') ? 'text-blue-400 font-bold' : line.includes('[나레이션]') ? 'text-red-400' : 'text-slate-400'}>{line}</p>
                       ))}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-black text-slate-400 mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span> AI 비주얼 가이드 (5 Scenes)
                    </h5>
                    <div className="space-y-3">
                      {selectedConcept.visualScenes.map((scene) => (
                        <div key={scene.sceneNumber} className="bg-slate-50 p-4 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-slate-400">SCENE 0{scene.sceneNumber}</span>
                          </div>
                          <p className="text-slate-800 text-[11px] font-bold mb-1">{scene.description}</p>
                          <p className="text-slate-400 text-[9px] italic font-mono truncate group-hover:whitespace-normal">{scene.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white border-4 border-dashed border-slate-100 rounded-[3rem] p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              </div>
              <h3 className="text-slate-400 font-black text-lg mb-2">컨셉을 생성하고 선택하세요</h3>
              <p className="text-slate-300 text-xs font-bold leading-relaxed">AI 나레이션 미리듣기와 <br/>자막 자동 추출 기능이 지원됩니다.</p>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
};

export default App;
