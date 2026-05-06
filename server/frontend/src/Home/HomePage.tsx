import ExperienceSection from "./components/ExperienceSection";
import FeatureSection from "./components/FeatureSection";
import HeroSection from "./components/HeroSection";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import UpdateSection from "./components/UpdateSection";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useUpdateInfo } from "../hooks/useUpdateInfo";

export default function HomePage() {
  const updateState = useUpdateInfo();
  useScrollReveal();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fcff] text-pisa-ink">
      <SiteHeader />
      <HeroSection updateState={updateState} />
      <FeatureSection />
      <ExperienceSection />
      <UpdateSection updateState={updateState} />
      <SiteFooter />
    </main>
  );
}
