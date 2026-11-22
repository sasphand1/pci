import type {ReactNode} from 'react';

/** Every page built from the Fifi design sits inside this wrapper, which scopes the design's tokens and reset. */
export function FifiPage({children}: {children: ReactNode}) {
  return <div className="fifi">{children}</div>;
}
