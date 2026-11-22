import type {ReactNode} from 'react';

/** Every page built from the Fifi design sits inside this wrapper, which scopes the design's tokens and reset.
 *  `contents` removes the wrapper's own box so a sticky header inside it can stick to the whole page. */
export function FifiPage({children, contents = false}: {children: ReactNode; contents?: boolean}) {
  return <div className={contents ? 'fifi contents' : 'fifi'}>{children}</div>;
}
