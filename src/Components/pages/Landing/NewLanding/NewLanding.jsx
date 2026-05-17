import React from "react";
import "./newLanding.scss";
import Header from "./sections/Header/Header";
import Banner from "./sections/Banner/Banner";
import BusinessProblems from "./sections/BusinessProblems/BusinessProblems";
import UnitedBusiness from "./sections/UnitedBusiness/UnitedBusiness";
import Rate from "./sections/Rate/Rate";
import Included from "./sections/Included/Included";
import Team from "./sections/Team/Team";
import Base from './sections/Base/Base'
import Demo from './sections/Demo/Demo'
import Footer from './sections/Footer/Footer'
import Sphere from './sections/Sphere/Sphere'

const NewLanding = () => {
  return (
    <div className="new-landing-page">
      <Header />
      <main>
        <Banner />
        <BusinessProblems />
        <UnitedBusiness />
        <Sphere/>
        <Rate />
        <Included />
        <Team />
        <Base/>
        <Demo/>
      </main>
      <Footer/>
    </div>
  );
};

export default NewLanding;
