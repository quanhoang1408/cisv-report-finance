import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { createDelegation } from '../db/seed'
import { CurrencySelect, Field, Frame, Header, PrimaryButton, SectionLabel, TextLink } from '../components/ui'
import { importSnapshotFile } from '../lib/snapshot'

const PROGRAMMES = ['Village', 'Step Up', 'Youth Meeting', 'Seminar Camp', 'Interchange', 'IPP', 'Mosaic', 'Khác']

export default function Setup() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [programme, setProgramme] = useState('Village')
  const [hostCountry, setHostCountry] = useState('')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [localCurrency, setLocalCurrency] = useState('USD')
  const [baseCurrency, setBaseCurrency] = useState('VND')
  const [bridgeCurrency, setBridgeCurrency] = useState('USD')
  const [usdToBase, setUsdToBase] = useState('')
  const [pin, setPin] = useState(() => String(Math.floor(1000 + Math.random() * 9000)))
  const [leaderName, setLeaderName] = useState('')
  const [delegates, setDelegates] = useState(['', '', '', ''])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!name.trim()) return setErr('Nhập tên đoàn')
    if (!/^\d{4,6}$/.test(pin)) return setErr('Mã PIN phụ huynh phải là 4–6 chữ số')
    if (delegates.filter((d) => d.trim()).length === 0) return setErr('Nhập ít nhất 1 delegate')
    setBusy(true)
    try {
      await createDelegation({ name: name.trim(), programme, hostCountry: hostCountry.trim(), year, localCurrency, baseCurrency, bridgeCurrency, parentPin: pin, leaderName: leaderName.trim(), delegateNames: delegates, usdToBase: Number(usdToBase.replace(/[^\d.]/g, '')) || undefined })
      nav('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function restore(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      await importSnapshotFile(file)
      nav('/', { replace: true })
    } catch (e) {
      setErr(`Không đọc được file: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Frame>
      <Header label="Bắt đầu" title="Tạo đoàn mới" />
      <form onSubmit={submit}>
        <SectionLabel top>Đoàn</SectionLabel>
        <div className="px-5 space-y-3">
          <Field label="Tên đoàn"><input className="input" placeholder="VD: Đoàn CISV Hà Nội" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chương trình">
              <select className="input" value={programme} onChange={(e) => setProgramme(e.target.value)}>{PROGRAMMES.map((p) => <option key={p}>{p}</option>)}</select>
            </Field>
            <Field label="Năm"><input className="input num" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></Field>
          </div>
          <Field label="Nước đăng cai"><input className="input" placeholder="VD: India" value={hostCountry} onChange={(e) => setHostCountry(e.target.value)} /></Field>
        </div>

        <SectionLabel top>Tiền tệ</SectionLabel>
        <div className="px-5 space-y-3">
          <Field label="Tiền nước đăng cai (tiêu tại trại)"><CurrencySelect value={localCurrency} onChange={setLocalCurrency} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tiền mang đi"><CurrencySelect value={bridgeCurrency} onChange={setBridgeCurrency} /></Field>
            <Field label="Tiền ở nhà"><CurrencySelect value={baseCurrency} onChange={setBaseCurrency} /></Field>
          </div>
          <Field label={`1 ${bridgeCurrency} = ? ${baseCurrency} (tuỳ chọn)`} hint="Để quy đổi bảng quyết toán ra tiền ở nhà. Sửa được sau.">
            <input className="input num" inputMode="decimal" placeholder="VD: 26350" value={usdToBase} onChange={(e) => setUsdToBase(e.target.value)} />
          </Field>
        </div>

        <SectionLabel top>Thành viên</SectionLabel>
        <div className="px-5 space-y-3">
          <Field label="Tên Leader"><input className="input" placeholder="VD: Quân" value={leaderName} onChange={(e) => setLeaderName(e.target.value)} /></Field>
          <Field label="Delegates">
            <div className="space-y-2">
              {delegates.map((d, i) => (
                <input key={i} className="input" placeholder={`Delegate ${i + 1}`} value={d} onChange={(e) => setDelegates(delegates.map((x, j) => (j === i ? e.target.value : x)))} />
              ))}
              <TextLink onClick={() => setDelegates([...delegates, ''])}>Thêm dòng</TextLink>
            </div>
          </Field>
        </div>

        <SectionLabel top>Phụ huynh</SectionLabel>
        <div className="px-5">
          <Field label="Mã PIN cho phụ huynh (4–6 số)" hint="Phụ huynh nhập mã này để xem sổ quỹ của đoàn.">
            <input className="input !h-[56px] text-[28px] tracking-[0.5em] font-extrabold num" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>

        {err && <p className="px-5 pt-3 text-[13px] neg">{err}</p>}
        <div className="px-5 pt-5 pb-8 space-y-2">
          <PrimaryButton disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo đoàn'}</PrimaryButton>
          <label className="btn-secondary cursor-pointer"><Upload size={18} /><span>Khôi phục từ file sao lưu (.json)</span>
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
          </label>
        </div>
      </form>
    </Frame>
  )
}
