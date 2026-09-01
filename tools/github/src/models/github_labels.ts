/**
 * The shape of a github label as returned by the official github API
 */
export type GithubApiLabel = {
    id: number;
    node_id: string;
    url: string;
    name: string;
    description: string | null;
    color: string;
    default: boolean;
}

/**
 * Compact representation of a Github label
 */
export type GithubCompactLabel = {
    name: string;
    description: string | null;
    color: string;
    default: boolean;
}