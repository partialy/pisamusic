import DownloadSection from "./components/DownloadSection";
import FeatureSection from "./components/FeatureSection";
import HeroSection from "./components/HeroSection";
import ProductShowcaseSection from "./components/ProductShowcaseSection";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import SyncSection from "./components/SyncSection";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useUpdateInfo } from "../hooks/useUpdateInfo";

export default function HomePage() {
  const updateState = useUpdateInfo();
  useScrollReveal();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fcff] text-pisa-ink">
      <SiteHeader />
      <HeroSection updateState={updateState} />
      <ProductShowcaseSection />
      <FeatureSection />
      <SyncSection />
      <DownloadSection updateState={updateState} />
      <SiteFooter />
    </main>
  );
}
