import { useParams } from 'react-router-dom'
import { useActiveDelegationId, useDelegationData } from '../hooks/useDelegation'
import { fmt } from '../lib/money'
import { Frame, Header, HeroNumber, SectionLabel, Spinner, TextLink } from '../components/ui'
import { FundRow, TxList, approxLine, fundStats } from '../components/shared'

export function Funds() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  const shared = data.funds.filter((f) => f.type !== 'PERSONAL')
  const personal = data.funds.filter((f) => f.type === 'PERSONAL')
  return (
    <Frame nav>
      <Header label={`${data.funds.length} rổ tiền`} title="Quỹ ngân sách" back="/" />
      <SectionLabel right="Còn lại" top>Quỹ chung</SectionLabel>
      <div className="border-b border-divider">{shared.map((f) => <FundRow key={f.id} data={data} fund={f} link={`/funds/${f.id}`} />)}</div>
      {personal.length > 0 && (
        <>
          <SectionLabel right="Còn lại" top>Pocket money</SectionLabel>
          <div className="border-b border-divider">{personal.map((f) => <FundRow key={f.id} data={data} fund={f} link={`/funds/${f.id}`} />)}</div>
        </>
      )}
      <div className="px-5 py-3"><TextLink to="/settings#funds">Thêm / sửa quỹ, đặt ngân sách</TextLink></div>
    </Frame>
  )
}

export function FundDetail() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const { fundId } = useParams()
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  const fund = data.funds.find((f) => f.id === fundId)
  if (!fund) return <Frame nav><Header title="Quỹ" back="/funds" /><p className="px-5 text-[13px] text-neutral-700">Không tìm thấy.</p></Frame>
  const txs = data.transactions.filter((t) => t.fundId === fund.id)
  const { cur, exp, net, budget, pct } = fundStats(data, fund)
  return (
    <Frame nav>
      <Header label={`${txs.length} giao dịch`} title={fund.name} back="/funds" />
      <HeroNumber label="Còn lại" size="md" value={net == null ? '—' : fmt(net, cur)} negative={net != null && net < 0} sub={`Đã chi ${fmt(exp, cur)} / ${fmt(budget, cur)} · ${pct}%${net != null ? ' · ' + approxLine(data, net, cur) : ''}`} />
      <div className="px-5 py-3 flex flex-col">
        <TextLink to={`/add?type=income&fund=${fund.id}`}>Thu vào quỹ</TextLink>
        <TextLink to={`/add?type=expense&fund=${fund.id}`}>Chi từ quỹ</TextLink>
      </div>
      <SectionLabel top>Giao dịch</SectionLabel>
      <TxList data={data} transactions={txs} link />
    </Frame>
  )
}
