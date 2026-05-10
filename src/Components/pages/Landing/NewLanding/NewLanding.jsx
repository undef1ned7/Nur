import React from "react";
import "./newLanding.scss";
import Header from "./sections/Header/Header";
import Banner from "./sections/Banner/Banner";

const NewLanding = () => {
  return (
    <div className="new-landing-page">
      <Header />
      <main>
        <Banner />
      </main>
    </div>
  );
};

export default NewLanding;
