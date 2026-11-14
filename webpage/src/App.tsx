import { Agent, BrowserFeatures, Footer, Header, Hero, OpenSource, Privacy, Status } from './components/Sections';

export function App() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Agent />
        <Privacy />
        <BrowserFeatures />
        <OpenSource />
        <Status />
      </main>
      <Footer />
    </>
  );
}
