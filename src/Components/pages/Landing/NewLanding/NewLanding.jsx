import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import "./newLanding.scss";
import LazySection from "./components/LazySection";
import Header from "./sections/Header/Header";
import Banner from "./sections/Banner/Banner";
import BusinessProblems from "./sections/BusinessProblems/BusinessProblems";
import Footer from "./sections/Footer/Footer";

const UnitedBusiness = lazy(
  () => import("./sections/UnitedBusiness/UnitedBusiness"),
);
const Sphere = lazy(() => import("./sections/Sphere/Sphere"));
const Rate = lazy(() => import("./sections/Rate/Rate"));
const Included = lazy(() => import("./sections/Included/Included"));
const Team = lazy(() => import("./sections/Team/Team"));
const Base = lazy(() => import("./sections/Base/Base"));
const Demo = lazy(() => import("./sections/Demo/Demo"));

const SUPPORT_PHONE_HREF = "tel:+996551900556";

const NewLanding = () => {
  const { t } = useTranslation("newLanding");
  const { hash } = useLocation();

  useEffect(() => {
    const id = hash.replace("#", "");
    if (!id) return undefined;

    let attempts = 0;
    let timerId = 0;

    const scrollToTarget = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (attempts < 24) {
        attempts += 1;
        timerId = window.setTimeout(scrollToTarget, 100);
      }
    };

    timerId = window.setTimeout(scrollToTarget, 100);
    return () => window.clearTimeout(timerId);
  }, [hash]);

  return (
    <div className="new-landing-page">
      <Header />
      <main>
        <Banner />
        <BusinessProblems />
        <LazySection sectionId="features" minHeight={480}>
          <Suspense fallback={null}>
            <UnitedBusiness />
          </Suspense>
        </LazySection>
        <LazySection sectionId="for-whom" minHeight={520}>
          <Suspense fallback={null}>
            <Sphere />
          </Suspense>
        </LazySection>
        <LazySection sectionId="tariff" minHeight={560}>
          <Suspense fallback={null}>
            <Rate />
          </Suspense>
        </LazySection>
        <LazySection minHeight={420}>
          <Suspense fallback={null}>
            <Included />
          </Suspense>
        </LazySection>
        {/* <LazySection sectionId="team" minHeight={480}>
          <Suspense fallback={null}>
            <Team />
          </Suspense>
        </LazySection> */}
        <LazySection minHeight={420}>
          <Suspense fallback={null}>
            <Base />
          </Suspense>
        </LazySection>
        <LazySection sectionId="demo" minHeight={400}>
          <Suspense fallback={null}>
            <Demo />
          </Suspense>
        </LazySection>
      </main>
      <LazySection minHeight={320}>
        <Footer />
      </LazySection>
      <a
        className="new-landing-page__support-phone"
        href={SUPPORT_PHONE_HREF}
      >
        {t("supportPhone.label")}: {t("supportPhone.number")}
      </a>
    </div>
  );
};

export default NewLanding;
