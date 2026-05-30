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
    fetchPriority={priority ? "high" : "auto"}
    {...rest}
  />
);

export default LandingImg;
