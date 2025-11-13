import React, { useState } from 'react';
import Create from './Create/Create';
import Whynur from './Whynur/Whynur';
import styles from './Registration.module.scss';

const Registration = () => {
  const [step, setStep] = useState(1);

  const renderStep = () => {
    if (step === 1) {
      return <Create onNextStep={() => setStep(2)} />;
    } else if (step === 2) {
      return <Whynur />;
    }
    return null;
  };

  return (
    <div className={styles.registration}>
      {renderStep()}
    </div>
  );
};

export default Registration;