/**
 * @param {import("../../lib/snapshot.mjs").Snapshot} snapshot
 * @param {{ name: string; url: string }} registry
 * @param {string} version
 */
export declare function serverJson(snapshot: import("../../lib/snapshot.mjs").Snapshot, { name, url }: {
    name: string;
    url: string;
}, version: string): {
    $schema: string;
    name: string;
    title: string;
    description: string;
    version: string;
    remotes: {
        type: string;
        url: string;
    }[];
};
