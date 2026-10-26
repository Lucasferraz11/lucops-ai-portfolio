import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Icon } from './Icon'
import { useAnalysis } from '../state/AnalysisContext'

export function UploadPanel() {
  const { selectedFile, analysis, isAnalyzing, error, selectFile, analyze } = useAnalysis()
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function acceptFile(file: File | null) {
    selectFile(file)
    if (input.current) input.current.value = ''
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0] ?? null)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    acceptFile(event.dataTransfer.files[0] ?? null)
  }

  return (
    <>
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-panel-raised text-primary">
          <Icon name="upload" className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Ingestão de novos datasets</h2>
          <p className="mt-1 text-sm text-muted">Selecione ou arraste um CSV para analisar sua qualidade.</p>
        </div>
      </div>
      <div
        className={`rounded-lg border border-dashed px-4 py-6 text-center transition-colors sm:px-6 sm:py-8 ${dragging ? 'border-primary bg-primary/10' : 'border-outline bg-panel-soft/60'}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
        onDrop={onDrop}
      >
        <Icon name="upload" className="mx-auto h-9 w-9 text-primary" />
        <p className="mt-3 font-display text-sm font-semibold text-ink">
          {selectedFile ? 'Arquivo selecionado' : 'Arraste um arquivo CSV para cá'}
        </p>
        <p className="mt-1 break-all text-sm text-muted" data-testid="selected-file">
          {selectedFile?.name ?? 'Ou escolha um arquivo no seu dispositivo.'}
        </p>
        <input ref={input} type="file" accept=".csv,text/csv" className="peer sr-only" id="csv-upload" aria-label="Arquivo CSV" onChange={onFileChange} />
        <label htmlFor="csv-upload" className="mt-5 inline-flex min-h-10 cursor-pointer items-center rounded-md border border-outline bg-panel-raised px-4 text-sm font-semibold text-ink hover:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
          {selectedFile ? 'Substituir arquivo' : 'Selecionar CSV'}
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">O arquivo permanece disponível apenas nesta sessão da aplicação.</p>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary-strong px-5 text-sm font-semibold text-[#003640] transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!selectedFile || isAnalyzing}
          onClick={() => void analyze()}
        >
          {isAnalyzing ? 'Analisando...' : 'Analisar qualidade'}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-md border border-[#ffb4ab]/40 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">{analysis ? `A atualização falhou: ${error} Os resultados exibidos pertencem à última análise concluída deste arquivo.` : error}</p>}
      {analysis && !error && !isAnalyzing && <p role="status" className="mt-4 rounded-md border border-positive/40 bg-positive/10 px-4 py-3 text-sm text-positive">Análise de qualidade concluída para {selectedFile?.name}.</p>}
      {analysis && isAnalyzing && <p role="status" className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">Atualizando análise. O resultado anterior permanece visível até a conclusão.</p>}
    </>
  )
}
