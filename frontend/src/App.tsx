import { useEffect, useMemo, useState } from 'react'
import './App.css'
import QuestionRenderer from './components/QuestionRenderer'
import { createProduct, fetchProduct, addAnswers, generateQuestions, generateReport, type Question, signup, login, setToken as setApiToken } from './api'

type StagedAnswer = { questionId?: string; answerText?: string | null; answerJson?: any }

function StepBadge({ active, children }: { active: boolean; children: any }){
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-sm ${active ? 'bg-indigo-500' : 'bg-zinc-600'}`}>
      {children}
    </div>
  )
}

function App() {
  const [token, setToken] = useState<string | null>(typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [productName, setProductName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [productId, setProductId] = useState<string | null>(null)

  const [questions, setQuestions] = useState<Question[]>([])
  const [staged, setStaged] = useState<Record<string, StagedAnswer>>({})
  const [contextText, setContextText] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const stagedList = useMemo(() => Object.values(staged), [staged])
  const hasMeaningfulAnswer = useMemo(() =>
    stagedList.some(a => {
      const t = (a.answerText ?? '').toString().trim()
      return t.length > 0 || a.answerJson != null
    })
  , [stagedList])

  async function handleAuth(){
    setError(null)
    setLoading(true)
    try {
      if (authMode === 'signup'){
        const r = await signup({ email, password, companyName: companyName || undefined })
        setToken(r.token)
        setApiToken(r.token)
        setUserEmail(email)
      } else {
        const r = await login({ email, password })
        setToken(r.token)
        setApiToken(r.token)
        setUserEmail(email)
      }
    } catch (e: any){
      setError(e?.message || 'Auth failed')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout(){
    setApiToken(null)
    setToken(null)
    setUserEmail('')
    // reset working state
    setProductId(null)
    setQuestions([])
    setStaged({})
    setContextText('')
    setPdfBase64(null)
    setProductName('')
    setSku('')
    setCategory('')
  }

  async function handleCreateProduct(){
    setError(null)
    setLoading(true)
    try {
      const r = await createProduct({ name: productName, sku: sku || undefined, category: category || undefined })
      setProductId(r.id)
      const data = await fetchProduct(r.id)
      setQuestions(data.questions)
      setPdfBase64(null)
    } catch (e: any){
      setError(e?.message || 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateInitialQuestions(){
    if (!productId) return
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const r = await generateQuestions(productId, [], contextText)
      if (Array.isArray(r.questions) && r.questions.length){
        const mapped: Question[] = r.questions.map((q, idx) => ({
          id: (q as any).id,
          question_text: q.question_text,
          question_type: q.question_type,
          metadata: (q as any).metadata,
          order_index: questions.length + idx,
        }))
        setQuestions(prev => [...prev, ...mapped])
      } else if (r?.dedupedAll){
        setInfo('No new follow-ups this round (duplicates skipped). Try adding more detail or adjusting context.')
      } else {
        setInfo('AI did not generate new questions for this input. Try adding more detail or adjusting context.')
      }
    } catch (e: any){
      setError(e?.message || 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAnswers(){
    if (!productId) return
    const answers = stagedList
    if (!answers.length || !hasMeaningfulAnswer){
      setInfo('Please enter at least one answer before saving.')
      return
    }
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await addAnswers(productId, answers)
      setStaged({})
      const r = await generateQuestions(productId, answers, contextText)
      if (Array.isArray(r.questions) && r.questions.length){
        const mapped: Question[] = r.questions.map((q, idx) => ({
          id: (q as any).id,
          question_text: q.question_text,
          question_type: q.question_type,
          metadata: (q as any).metadata,
          order_index: questions.length + idx,
        }))
        setQuestions(prev => [...prev, ...mapped])
      } else if (r?.dedupedAll){
        setInfo('No new follow-ups this round (duplicates skipped). Try adding more detail or adjusting context.')
      } else {
        setInfo('AI did not generate new follow-ups for these answers. Try adding more specific details or context.')
      }
    } catch (e: any){
      setError(e?.message || 'Failed to save answers')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateReport(){
    if (!productId) return
    setLoading(true)
    setError(null)
    try {
      const r = await generateReport(productId)
      setPdfBase64(r.report.pdf_base64)
    } catch (e: any){
      setError(e?.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // noop: could preload sample product
  }, [])

  // If not authenticated, show only auth view (auth-first UX)
  if (!token){
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="m-0 text-2xl font-semibold">Product Transparency</h1>
          <div className="text-xs text-zinc-500">Please sign up or log in to continue</div>
        </div>
        {error && <div className="text-red-500 mb-3">{error}</div>}
      {info && <div className="text-indigo-300 mb-3">{info}</div>}
        <section className="border border-zinc-700 rounded-lg p-4 mb-4 bg-zinc-900/40">
          <h2 className="text-lg font-medium mb-3">{authMode === 'signup' ? 'Sign up' : 'Log in'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-400">Email</label>
              <input className="block w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Password</label>
              <input type="password" className="block w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {authMode === 'signup' && (
              <div className="md:col-span-2">
                <label className="text-sm text-zinc-400">Company (optional)</label>
                <input className="block w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-3">
            <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50" disabled={loading || !email || !password} onClick={handleAuth}>{authMode === 'signup' ? 'Create account' : 'Log in'}</button>
            <button className="px-4 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')} type="button">
              Switch to {authMode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </div>
        </section>
      </div>
    )
  }

  // Authenticated view
  return (
    <div className="min-h-screen max-w-5xl mx-auto px-3 sm:px-4 py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3">
        <h1 className="m-0 text-2xl font-semibold">Product Transparency</h1>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400">{userEmail || 'Signed in'}</div>
          <button className="px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800" onClick={handleLogout} type="button">Logout</button>
        </div>
      </div>
      {error && <div className="text-red-500 mb-3">{error}</div>}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4">
        <StepBadge active={!productId}>1</StepBadge>
        <div className="h-0.5 bg-zinc-700 flex-1" />
        <StepBadge active={!!productId && questions.length === 0}>2</StepBadge>
        <div className="h-0.5 bg-zinc-700 flex-1" />
        <StepBadge active={!!productId && questions.length > 0}>3</StepBadge>
      </div>

      {token && (
      <section className="border border-zinc-700 rounded-lg p-4 mb-4 bg-zinc-900/40">
        <h2>1. Create Product</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-zinc-400">Name</label>
            <input className="block w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={productName} onChange={(e) => setProductName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">SKU</label>
            <input className="block w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Category</label>
            <input className="block w-full mt-1 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>
        <button className="mt-3 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 w-full sm:w-auto" disabled={loading || !productName} onClick={handleCreateProduct}>Create</button>
        {productId && <div className="mt-2 text-sm text-zinc-500">Product ID: {productId}</div>}
      </section>
      )}

      {token && (
      <section className="border border-zinc-700 rounded-lg p-4 mb-4 bg-zinc-900/40">
        <h2>2. Answer Questions</h2>
        {!productId && <div className="text-sm text-zinc-400">Create a product to start.</div>}
        {productId && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-zinc-400">Context (optional)</label>
              <textarea className="block w-full mt-1 min-h-16 rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500" value={contextText} onChange={(e) => setContextText(e.target.value)} placeholder="Tell the AI what to focus on (e.g. sustainability, safety, compliance)" />
            </div>
            {questions.length === 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-sm text-zinc-400">No questions yet. Add context and click below to generate initial questions.</div>
                <div>
                  <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 w-full sm:w-auto" disabled={loading} onClick={handleGenerateInitialQuestions}>Generate initial questions</button>
                </div>
              </div>
            )}
            {questions.map((q) => (
              <div key={q.id} className="p-3 border border-zinc-700 rounded-md">
                <QuestionRenderer
                  question={q}
                  onChange={(ans) => setStaged((prev) => ({ ...prev, [q.id]: ans }))}
                />
              </div>
            ))}
            <div>
              <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 w-full sm:w-auto" disabled={loading || !stagedList.length || !hasMeaningfulAnswer} onClick={handleSaveAnswers}>Save answers & generate follow-ups</button>
            </div>
          </div>
        )}
      </section>
      )}

      {token && (
      <section className="border border-zinc-700 rounded-lg p-4 mb-4 bg-zinc-900/40">
        <h2>3. Report</h2>
        <button className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 w-full sm:w-auto" disabled={loading || !productId} onClick={handleGenerateReport}>Generate PDF Report</button>
        {pdfBase64 && (
          <div className="mt-3">
            <a className="text-indigo-400 hover:underline" href={`data:application/pdf;base64,${pdfBase64}`} download={`report-${productId}.pdf`}>
              Download PDF
            </a>
            <div className="mt-3">
              <iframe title="report" src={`data:application/pdf;base64,${pdfBase64}`} className="w-full h-[600px] border border-zinc-700" />
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  )
}

export default App
