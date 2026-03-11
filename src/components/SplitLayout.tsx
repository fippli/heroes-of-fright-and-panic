import type { ReactNode } from "react";

type SplitLayoutProps = {
  readonly pageTitle?: string;
  readonly children: ReactNode;
};

export const SplitLayout = ({ pageTitle, children }: SplitLayoutProps) => {
  return (
    <div className="split-layout">
      <div className="split-layout__left">
        <h1>
          Heroes
          <br />
          of Fright
          <br />
          and Panic
        </h1>
      </div>
      <div className="split-layout__right">
        <div className="split-layout__content">
          {pageTitle !== undefined && <h2>{pageTitle}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
};
