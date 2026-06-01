# Dimension 14: CI/CD Runtime & Deployment Model

## Purpose

Understand how code review agents are packaged, deployed, configured, and executed in real developer environments.

## Background

A self-hosted CodeRabbit alternative needs a practical runtime model. Some tools run as GitHub Actions, some as Docker containers, some as long-running webhook services, some as CLIs, and some as hosted SaaS. Each model affects cost, latency, secrets management, scalability, reliability, and ease of adoption.

## Steps

1. Read `prompts/base.md` for execution instructions.
2. For each repo in the group:

   * Identify deployment options.
   * Inspect Dockerfiles, compose files, Helm charts, GitHub Actions, or CI templates.
   * Determine required environment variables and secrets.
   * Check how jobs are queued, retried, and scaled.
3. Answer the questions below for each repo.
4. Write per-repo analysis to `results/14-ci-cd-runtime-and-deployment-model/{repo-name}.md`.

## Evidence

For each repo, collect:

* Dockerfile
* docker-compose files
* CI workflow examples
* Helm/Kubernetes manifests if present
* Environment variable docs
* Queue/background worker code
* Deployment documentation

## Questions

1. How is the review agent deployed?
2. Can it run fully self-hosted?
3. Does it require a long-running server?
4. Can it run as a one-off CI job?
5. How are secrets managed?
6. How are failures retried?
7. How hard would it be to run this cheaply for personal projects?
8. How hard would it be to scale for an organisation?

## Analysis Axes

* **Deployment simplicity**: Can users get it running quickly?
* **Operational maturity**: Does it handle retries, logs, queues, and failures?
* **Security posture**: Are secrets and permissions handled carefully?
* **Cost control**: Can it run cheaply and predictably?
* **Scalability**: Can it support many repos and PRs?

## Rating

Assign a score from 1–10 based on the rubric below.

| Score | Meaning                                                                         |
| ----- | ------------------------------------------------------------------------------- |
| 1–3   | Difficult to deploy or poorly documented runtime                                |
| 4–6   | Works locally or in CI but has operational limitations                          |
| 7–8   | Clean self-hosted or CI deployment model                                        |
| 9–10  | Production-ready deployment with strong security, scaling, and failure handling |

Fast heuristic:

> "Could I run this for my own repos without turning it into a DevOps project?"

## Output

Write findings to `reports/source/14-ci-cd-runtime-and-deployment-model/{source-name}.md` using `../../templates/repo-analysis.md`.

For each repo, provide:

* Deployment model
* Runtime dependencies
* Secret/configuration model
* Operational risks
* Recommended Ultraplan deployment approach