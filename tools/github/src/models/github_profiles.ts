/** One row of `github_profiles` - an owner/repo preset, at most one active per server. */
export type GithubProfile = {
  id: number;
  server_id: number;
  profile_name: string;
  repository_owner: string;
  repository_name: string;
  is_active: 0 | 1;
};
