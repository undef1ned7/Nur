import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const LazySection = ({
  children,
  sectionId,
  minHeight = 320,
  rootMargin = "200px 0px",
  className = "",
}) => {
  const { hash } = useLocation();
  const targetId = hash.replace("#", "");
  const ref = useRef(null);
  const [visible, setVisible] = useState(
    () => Boolean(sectionId && targetId === sectionId),
  );

  useEffect(() => {
    if (sectionId && targetId === sectionId) {
      setVisible(true);
    }
  }, [sectionId, targetId]);

  useEffect(() => {
    if (visible) return undefined;

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div
      ref={ref}
      className={className}
      style={!visible ? { minHeight } : undefined}
    >
      {visible ? children : null}
    </div>
  );
};

export default LazySection;
