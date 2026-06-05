const LandingImg = ({
  src,
  alt = "",
  className,
  width,
  height,
  priority = false,
  ...rest
}) => (
  <img
    src={src}
    alt={alt}
    className={className}
    width={width}
    height={height}
    loading={priority ? "eager" : "lazy"}
    decoding={priority ? "sync" : "async"}
    {...(priority ? { fetchpriority: "high" } : {})}
    {...rest}
  />
);

export default LandingImg;
