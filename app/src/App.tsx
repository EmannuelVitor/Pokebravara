import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './lib/auth';
import Shell from './ui/Shell';
import { Loading } from './ui/ui';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';

const Home = lazy(() => import('./pages/Home'));
const Sheet = lazy(() => import('./pages/Sheet'));
const Team = lazy(() => import('./pages/Team'));
const Pc = lazy(() => import('./pages/Pc'));
const Bag = lazy(() => import('./pages/Bag'));
const Pokedex = lazy(() => import('./pages/Pokedex'));
const MapPage = lazy(() => import('./pages/MapPage'));
const BattlePage = lazy(() => import('./pages/BattlePage'));
const Shop = lazy(() => import('./pages/Shop'));
const CampaignPage = lazy(() => import('./pages/CampaignPage'));
const MasterHome = lazy(() => import('./pages/master/MasterHome'));
const Trainers = lazy(() => import('./pages/master/Trainers'));
const TrainerHub = lazy(() => import('./pages/master/TrainerHub'));
const CampaignEditor = lazy(() => import('./pages/master/CampaignEditor'));

export default function App() {
    const { user, profile, loading, isProfessor } = useAuth();
    if (loading) return <div className="login"><Loading /></div>;
    if (!user) return <Login />;
    if (!profile) return <Onboarding />;

    return (
        <Shell>
            <Suspense fallback={<Loading />}>
                <Routes>
                    {isProfessor ? (
                        <>
                            <Route path="/" element={<MasterHome />} />
                            <Route path="/treinadores" element={<Trainers />} />
                            <Route path="/treinadores/:id" element={<TrainerHub />} />
                            <Route path="/mestre/campanha" element={<CampaignEditor />} />
                        </>
                    ) : (
                        <>
                            <Route path="/" element={<Home />} />
                            <Route path="/ficha" element={<Sheet />} />
                            <Route path="/time" element={<Team />} />
                            <Route path="/pc" element={<Pc />} />
                            <Route path="/mochila" element={<Bag />} />
                            <Route path="/loja" element={<Shop />} />
                        </>
                    )}
                    <Route path="/pokedex" element={<Pokedex />} />
                    <Route path="/mapa" element={<MapPage />} />
                    <Route path="/campanha" element={<CampaignPage />} />
                    <Route path="/batalha" element={<BattlePage />} />
                    <Route path="/batalha/:id" element={<BattlePage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </Shell>
    );
}
