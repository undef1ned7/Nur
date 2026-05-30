import { useEffect, useState } from "react";
import { getIndustries } from "../../../../../api/auth";

let cachedIndustries = null;
let loadPromise = null;

const fetchIndustriesOnce = () => {
  if (cachedIndustries) {
    return Promise.resolve(cachedIndustries);
  }

  if (!loadPromise) {
    loadPromise = getIndustries()
      .then((data) => {
        cachedIndustries = Array.isArray(data) ? data : [];
        return cachedIndustries;
      })
      .catch(() => {
        cachedIndustries = [];
        return cachedIndustries;
      });
  }

  return loadPromise;
};

export const useLandingIndustries = () => {
  const [industries, setIndustries] = useState(cachedIndustries ?? []);
  const [loading, setLoading] = useState(cachedIndustries === null);

  useEffect(() => {
    let cancelled = false;

    fetchIndustriesOnce().then((data) => {
      if (!cancelled) {
        setIndustries(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { industries, loading };
};
