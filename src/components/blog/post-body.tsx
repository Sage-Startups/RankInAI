import { parseBlogBody, type Block, type InlineNode } from '@/lib/blog/content';

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

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
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

export function PostBody({ body }: { body: string }) {
  const blocks = parseBlogBody(body);
  return (
    <div className="text-[0.9375rem] text-[var(--foreground)]">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}
