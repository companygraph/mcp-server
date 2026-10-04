import type { Snapshot } from "../../lib/snapshot.mjs";
/** @import { Snapshot } from "../../lib/snapshot.mjs" */
/**
 * @param {Snapshot} snapshot
 * @param {{ repository: string }} deployment
 */
export declare function jsonld(snapshot: Snapshot, { repository }: {
    repository: string;
}): {
    "@context": string;
    "@graph": ({
        "@type": string;
        "@id": string;
        name: string;
        url: string | string[];
        image?: string;
        sameAs: string[];
        description?: never;
        documentation?: never;
        provider?: never;
        about?: never;
    } | {
        "@type": string;
        "@id": string;
        name: string;
        description: string;
        url: string;
        documentation: string;
        provider: {
            "@id": string;
        };
        about: {
            "@id": string;
        };
    })[];
} | null;
