/**
 * `server-only` is a Next.js marker package: importing it is how a module
 * declares that bundling it into a client component must fail. It has no
 * runtime behavior, and it is not resolvable outside Next's bundler, so the
 * test runner aliases it here.
 *
 * Aliasing it rather than removing the markers keeps the guarantee where it
 * belongs: `src/lib/blog/posts.ts` and friends still refuse to be imported
 * into a client component in the real build.
 */
export {};
