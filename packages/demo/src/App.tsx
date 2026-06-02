import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import BasicTest from './pages/BasicTest';
import LoginFlow from './pages/LoginFlow';
import { t } from './i18n';
import { useLang } from './components/useLang';
import './App.css';

function NavBar() {
  const lang = useLang();
  const nav = t('nav');
  const { pathname } = useLocation();
  const NAV = [
    { path: '/basic', label: nav.basic, desc: nav.basicDesc },
    { path: '/login', label: nav.login, desc: nav.loginDesc },
  ];
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">📡</span>
        <span className="brand-name">{nav.brand}</span>
        <span className="brand-tag">{nav.tag}</span>
      </div>
      <div className="navbar-links">
        {NAV.map((n) => (
          <Link
            key={n.path}
            to={n.path}
            className={`nav-link ${pathname === n.path ? 'active' : ''}`}
          >
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Home() {
  const lang = useLang();
  const home = t('home');
  const nav = t('nav');
  const NAV = [
    { path: '/basic', label: nav.basic, desc: nav.basicDesc },
    { path: '/login', label: nav.login, desc: nav.loginDesc },
  ];
  return (
    <div className="home">
      <div className="home-hero">
        <h1>{home.title}</h1>
        <p>{home.subtitle}</p>
      </div>
      <div className="home-cards">
        {NAV.map((n) => (
          <Link key={n.path} to={n.path} className="home-card">
            <div className="card-label">{n.label}</div>
            <div className="card-desc">{n.desc}</div>
          </Link>
        ))}
      </div>
      <div className="home-tip">
        <strong>{home.tip}</strong>{home.tipBody}{' '}
        <code>src/codelog.ts</code>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NavBar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/basic" element={<BasicTest />} />
          <Route path="/login" element={<LoginFlow />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
