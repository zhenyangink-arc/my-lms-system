// 学生端无界画布背后的极光弥散光斑，纯装饰、不需要交互状态，渲染一次即可。
export function AuroraOrbs() {
  return (
    <>
      <span className="app-aurora-orb app-aurora-orb-1" aria-hidden="true" />
      <span className="app-aurora-orb app-aurora-orb-2" aria-hidden="true" />
      <span className="app-aurora-orb app-aurora-orb-3" aria-hidden="true" />
    </>
  );
}
