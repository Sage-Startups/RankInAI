import { parseBlogBody, type Block, type InlineNode } from '@/lib/blog/content';
import { BLOG_IMAGE_PATH, type ImageSizes } from '@/lib/blog/images';

/**
 * Renders a post body as React elements.
 *
 * Every node becomes a real element — nothing is ever passed to
 * `dangerouslySetInnerHTML`, so a post cannot inject markup into the page
 * even if an author tries.
 */

function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'bold':
            return <strong key={i}>{node.value}</strong>;
          case 'code':
            return (
              <code
                key={i}
                className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[0.9em]"
              >
                {node.value}
              </code>
            );
          case 'link':
            return (
              <a
                key={i}
                href={node.href}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="text-[var(--accent)] underline underline-offset-4"
              >
                {node.value}
              </a>
            );
          default:
            return <span key={i}>{node.value}</span>;
        }
      })}
    </>
  );
}

/**
 * A plain `<img>`, not `next/image`, on purpose: the Image optimizer routes the
 * bytes through sharp, whose libvips advisories this project documents rather
 * than adopts, and no remote patterns are configured. Nothing is resized on the
 * server, so no decoder ever sees author-supplied input.
 *
 * `width` and `height` come from the stored dimensions when they are known, so
 * the browser reserves the space instead of reflowing the article as each image
 * arrives.
 */
function ImageBlock({ src, alt, sizes }: { src: string; alt: string; sizes: ImageSizes }) {
  const id = src.startsWith(`${BLOG_IMAGE_PATH}/`) ? src.slice(BLOG_IMAGE_PATH.length + 1) : null;
  const size = id ? sizes[id] : undefined;

  return (
    <figure className="my-7">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        {...(size ? { width: size.width, height: size.height } : {})}
        loading="lazy"
        decoding="async"
        className="h-auto w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]"
      />
    </figure>
  );
}

function BlockView({ block, sizes }: { block: Block; sizes: ImageSizes }) {
  switch (block.type) {
    case 'image':
      return <ImageBlock src={block.src} alt={block.alt} sizes={sizes} />;

    case 'heading':
      return block.level === 2 ? (
        <h2 className="mt-10 mb-3 text-xl font-bold tracking-tight sm:text-2xl">
          <Inline nodes={block.content} />
        </h2>
      ) : (
        <h3 className="mt-8 mb-2.5 text-lg font-semibold tracking-tight">
          <Inline nodes={block.content} />
        </h3>
      );

    case 'quote':
      return (
        <blockquote className="my-6 border-l-2 border-[var(--accent)] py-1 pl-4 text-[var(--muted-foreground)] italic">
          <Inline nodes={block.content} />
        </blockquote>
      );

    case 'list':
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-2 pl-6">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-2 pl-6">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline nodes={item} />
            </li>
          ))}
        </ul>
      );

    default:
      return (
        <p className="my-4 leading-relaxed">
          <Inline nodes={block.content} />
        </p>
      );
  }
}

export function PostBody({ body, imageSizes = {} }: { body: string; imageSizes?: ImageSizes }) {
  const blocks = parseBlogBody(body);
  return (
    <div className="text-[0.9375rem] text-[var(--foreground)]">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} sizes={imageSizes} />
      ))}
    </div>
  );
}
