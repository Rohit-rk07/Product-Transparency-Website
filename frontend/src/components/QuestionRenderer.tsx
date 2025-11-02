import { useState } from 'react'

type Props = {
  question: { id?: string; question_text: string; question_type: string; metadata?: any }
  onChange: (val: { questionId?: string; answerText?: string | null; answerJson?: any }) => void
}

export default function QuestionRenderer({ question, onChange }: Props){
  const [val, setVal] = useState<string>('')

  if (question.question_type === 'boolean'){
    return (
      <div>
        <label className="text-sm text-zinc-300">{question.question_text}</label>
        <div className="flex gap-2 mt-1">
          <button className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500" onClick={() => onChange({ questionId: question.id, answerText: 'Yes' })}>Yes</button>
          <button className="px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800" onClick={() => onChange({ questionId: question.id, answerText: 'No' })}>No</button>
        </div>
      </div>
    )
  }

  if (question.question_type === 'select'){
    const options: string[] = question.metadata?.options || []
    return (
      <div>
        <label className="text-sm text-zinc-300">{question.question_text}</label>
        <select
          className="block mt-1 w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-100"
          value={val}
          onChange={(e) => { setVal(e.target.value); onChange({ questionId: question.id, answerText: e.target.value }) }}
        >
          <option className="bg-zinc-900" value="">Select...</option>
          {options.map((o) => <option className="bg-zinc-900" key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div>
      <label className="text-sm text-zinc-300">{question.question_text}</label>
      <input
        className="block mt-1 w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-100 placeholder:text-zinc-500"
        value={val}
        onChange={(e) => { setVal(e.target.value); }}
        onBlur={() => onChange({ questionId: question.id, answerText: val })}
      />
    </div>
  )
}
