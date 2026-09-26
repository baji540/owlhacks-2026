import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { ExtensionDemo } from './components/ExtensionDemo'
import { TrustedContacts } from './components/TrustedContacts'
import { Download } from './components/Download'
import { FAQ } from './components/FAQ'
import { Footer } from './components/Footer'

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ExtensionDemo />
        <TrustedContacts />
        <Download />
        <FAQ />
      </main>
      <Footer />
    </>
  )
}

export default App
