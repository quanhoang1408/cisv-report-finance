import { Outlet, Route, Routes } from 'react-router-dom'
import { TabBar } from './components/ui'
import { useActiveDelegationId } from './hooks/useDelegation'
import { useAutoSync } from './lib/sync'
import Home from './pages/Home'
import Setup from './pages/Setup'
import AddTransaction from './pages/AddTransaction'
import Exchange from './pages/Exchange'
import CashCount from './pages/CashCount'
import { TransactionDetail, Transactions } from './pages/Transactions'
import { MemberDetail, Members } from './pages/Members'
import { FundDetail, Funds } from './pages/Funds'
import Settings from './pages/Settings'
import Share from './pages/Share'
import ParentView from './pages/ParentView'

function LeaderLayout({ nav }: { nav: boolean }) {
  const id = useActiveDelegationId()
  useAutoSync(id)
  return (
    <>
      <Outlet />
      {nav && <TabBar />}
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<Setup />} />
      <Route path="/p/:slug" element={<ParentView />} />
      <Route element={<LeaderLayout nav={false} />}>
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/tx/:txId" element={<TransactionDetail />} />
        <Route path="/tx/:txId/edit" element={<AddTransaction />} />
      </Route>
      <Route element={<LeaderLayout nav />}>
        <Route path="/" element={<Home />} />
        <Route path="/tx" element={<Transactions />} />
        <Route path="/exchange" element={<Exchange />} />
        <Route path="/exchange/:txId" element={<Exchange />} />
        <Route path="/count" element={<CashCount />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:memberId" element={<MemberDetail />} />
        <Route path="/funds" element={<Funds />} />
        <Route path="/funds/:fundId" element={<FundDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/share" element={<Share />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  )
}
