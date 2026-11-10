// Each track as Markdown at /tracks/<id>.md (src/lib/track-markdown.ts), for the lesson's Copy as Markdown
// button and for assistants that read /llms.txt.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { trackMarkdown } from "../../lib/track-markdown";

export const getStaticPaths = (async () =>
  (await getCollection("tracks")).map((track) => ({ params: { id: track.id }, props: { track } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(trackMarkdown((props as { track: CollectionEntry<"tracks"> }).track), { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
