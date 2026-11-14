import { Comparison } from './components/Comparison';
import {
  Agent,
  BrowserFeatures,
  Footer,
  GetStarted,
  Header,
  Hero,
  Memory,
  OpenSource,
  Privacy,
  Statement,
  Status,
} from './components/Sections';

export function App() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <Statement />
        <Agent />
        <Memory />
        <Privacy />
        <BrowserFeatures />
        <Comparison />
        <GetStarted />
        <OpenSource />
        <Status />
      </main>
      <Footer />
    </>
  );
}
