import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise overwrites AGENTS.md and CLAUDE.md with its own
  // boilerplate on every start. This project's AGENTS.md is hand-written and is
  // the source of truth for the whole build, so the generator stays off.
  agentRules: false,
};

export default nextConfig;
